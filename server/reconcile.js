/**
 * 渲染任务的补偿扫描（落作品库 / 失败退款）
 *
 * 背景：作品原来只在客户端轮询到 succeeded 时才写库。
 * 用户生成后直接关页面，就再也没人轮询，成片丢了、失败也不会退款。
 *
 * 做法：
 *   - 提交成功后把订单 key 登记进待查列表（全局 + 按用户各一份）
 *   - 用户回来登录时（/api/account/reconcile）只查自己的待办
 *   - Vercel Cron（/api/cron/reconcile）定期扫全局，兜底没人回来的情况
 *
 * 列表：
 *   jobs:pending          全局待查（key = job:<provider>:<jobId>）
 *   pending:u:<sub>       按用户待查
 *   reconcile:u:<sub>     用户维度的节流时间戳
 */
const adapter = require('./provider-adapter');
const credits = require('./credits');
const works = require('./works');
const store = require('./store');

const PENDING_ALL = 'jobs:pending';
const MIN_AGE_MS = 60 * 1000;            // 太新的任务先交给前端轮询
const MAX_AGE_MS = 72 * 60 * 60 * 1000;  // 超过 72 小时仍无结果就放弃（provider 记录多半已过期）
const USER_THROTTLE_MS = 90 * 1000;

function userPendingKey(userId) {
  return 'pending:u:' + userId;
}

function parseKey(key) {
  const parts = String(key || '').split(':');
  if (parts.length < 3 || parts[0] !== 'job') return null;
  return { provider: parts[1], jobId: parts.slice(2).join(':') };
}

/** 提交成功后登记待查（幂等：重复 push 由后面的 LREM 清掉） */
async function track(userId, orderKey) {
  await store.push(PENDING_ALL, orderKey);
  if (userId) await store.push(userPendingKey(userId), orderKey);
}

/** 任务已终态（成功/失败/放弃）后从待查列表摘掉 */
async function untrack(userId, orderKey) {
  await store.lrem(PENDING_ALL, orderKey);
  if (userId) await store.lrem(userPendingKey(userId), orderKey);
}

/**
 * 查一个任务并推进状态。
 * 返回：succeeded | failed | running | young | missing | expired | poll_error | done
 */
async function processKey(orderKey, opts) {
  const ref = parseKey(orderKey);
  if (!ref) {
    await store.lrem(PENDING_ALL, orderKey);
    return 'missing';
  }

  const rec = await credits.orderDone(orderKey);
  if (!rec) {
    await store.lrem(PENDING_ALL, orderKey);
    return 'missing';
  }
  if (rec.completed || rec.refunded) {
    await untrack(rec.userId, orderKey);
    return 'done';
  }

  const submittedAt = rec.at ? Date.parse(rec.at) : 0;
  const age = Date.now() - submittedAt;
  if (!opts || !opts.force) {
    if (age >= 0 && age < MIN_AGE_MS) return 'young';
    if (submittedAt && age > MAX_AGE_MS) {
      // provider 记录已过期：无法确认成片，按未交付处理，必须退款而不是静默丢弃
      console.error(JSON.stringify({ event: 'reconcile_expired', jobKey: orderKey, ageHours: Math.round(age / 3600000) }));
      if (!rec.refunded && rec.userId) {
        await credits.refundUser(rec.userId, rec.cost, 'job_expired');
        await works.addFailed(rec.userId, works.failedRecord(
          rec, ref.provider, ref.jobId, 'expired: provider record no longer available', true
        ));
        await credits.markOrder(orderKey, Object.assign({}, rec, {
          refunded: true,
          completed: true,
          expired: true,
          refundedAt: new Date().toISOString()
        }));
        console.log(JSON.stringify({ event: 'reconcile_expired_refunded', jobKey: orderKey, userId: rec.userId, credits: rec.cost }));
      }
      await untrack(rec.userId, orderKey);
      return 'expired';
    }
  }

  let state;
  try {
    state = await adapter.poll({
      provider: ref.provider,
      providerJobId: ref.jobId,
      statusUrl: rec.statusUrl,
      resultUrl: rec.resultUrl,
      model: rec.model
    });
  } catch (e) {
    console.error(JSON.stringify({ event: 'reconcile_poll_error', jobKey: orderKey, error: e.message }));
    return 'poll_error';
  }

  if (state.state === 'succeeded' && state.videoUrl) {
    const work = works.workRecord(rec, ref.provider, ref.jobId, state.videoUrl);
    await works.add(rec.userId, work);
    await credits.markOrder(orderKey, Object.assign({}, rec, {
      completed: true,
      completedAt: new Date().toISOString()
    }));
    await untrack(rec.userId, orderKey);
    console.log(JSON.stringify({ event: 'reconcile_succeeded', jobKey: orderKey, userId: rec.userId }));
    return 'succeeded';
  }

  if (state.state === 'failed' || state.state === 'canceled') {
    if (!rec.refunded && rec.userId) {
      const out = await credits.refundUser(rec.userId, rec.cost, 'job_' + state.state + '_reconcile');
      if (!out || !out.ok) {
        console.error(JSON.stringify({ event: 'reconcile_refund_failed', jobKey: orderKey, userId: rec.userId, error: out && out.error }));
        return 'refund_error';
      }
      console.log(JSON.stringify({ event: 'reconcile_refunded', jobKey: orderKey, userId: rec.userId, credits: rec.cost }));
    }
    // 失败也要在作品库留痕（含补偿扫描路径）
    if (rec.userId) {
      await works.addFailed(rec.userId, works.failedRecord(
        rec, ref.provider, ref.jobId, adapter.failureMessage(state.raw), true
      ));
    }
    await credits.markOrder(orderKey, Object.assign({}, rec, {
      refunded: true,
      completed: true,
      refundedAt: new Date().toISOString()
    }));
    await untrack(rec.userId, orderKey);
    return 'failed';
  }

  return 'running';
}

/** 查某个用户的待办任务（登录/刷新时调用） */
async function reconcileUser(userId, limit) {
  if (!userId) return { checked: 0, changed: 0 };
  const keys = await store.list(userPendingKey(userId), 10);
  if (!keys.length) return { checked: 0, changed: 0 };

  const throttleKey = 'reconcile:u:' + userId;
  const last = await store.getJson(throttleKey);
  if (last && Date.now() - Number(last) < USER_THROTTLE_MS) {
    return { checked: 0, changed: 0, throttled: true };
  }
  await store.setJson(throttleKey, Date.now());

  const batch = keys.slice(0, limit || 3);
  const out = { checked: 0, changed: 0 };
  const startedAt = Date.now();
  for (const key of batch) {
    if (Date.now() - startedAt > 25000) break; // 单次请求留足预算，避免超时
    const r = await processKey(key);
    out.checked++;
    if (r === 'succeeded' || r === 'failed' || r === 'expired') out.changed++;
  }
  return out;
}

/** 扫全局待办（Cron 调用） */
async function reconcileAll(limit) {
  const keys = await store.list(PENDING_ALL, 50);
  const batch = keys.slice(0, limit || 10);
  const out = { checked: 0, changed: 0 };
  const startedAt = Date.now();
  for (const key of batch) {
    if (Date.now() - startedAt > 45000) break; // 函数上限 60s
    const r = await processKey(key);
    out.checked++;
    if (r === 'succeeded' || r === 'failed' || r === 'expired') out.changed++;
  }
  return out;
}

/**
 * 兜底修复：扫所有未终态的订单记录（不依赖待查列表），强制复查。
 * 用于待查列表丢失、cron 未配置等情况下的人工补跑。
 */
async function repairStuck(limit) {
  const keys = await store.scan('order:job:*', 200);
  const out = { scanned: keys.length, checked: 0, changed: 0 };
  const startedAt = Date.now();
  for (const orderStoreKey of keys.slice(0, limit || 20)) {
    if (Date.now() - startedAt > 45000) break;
    const rec = await store.getJson(orderStoreKey);
    if (!rec || rec.completed || rec.refunded) continue;
    const r = await processKey(orderStoreKey.slice('order:'.length), { force: true });
    out.checked++;
    if (r === 'succeeded' || r === 'failed' || r === 'expired') out.changed++;
  }
  return out;
}

module.exports = {
  track,
  untrack,
  processKey,
  reconcileUser,
  reconcileAll,
  repairStuck,
  PENDING_ALL,
  MIN_AGE_MS,
  MAX_AGE_MS
};
