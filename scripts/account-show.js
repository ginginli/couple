#!/usr/bin/env node
/**
 * 查某个账号的积分与流水 —— 本地直连 KV，不需要线上 ADMIN_TOKEN
 *
 * 用法：
 *   KV_REST_API_URL=https://xxx.upstash.io KV_REST_API_TOKEN=xxx \
 *     node scripts/account-show.js user@gmail.com
 *
 *   # 也可以按 sub 查（sub 形如 g:1234567890）
 *   node scripts/account-show.js g:1234567890
 *
 *   # 只要最近 50 条（默认 50，上限 200）
 *   node scripts/account-show.js user@gmail.com 50
 *
 * 输出：账号信息、当前余额、流水明细（时间/类型/增减/变动后余额/备注）与汇总
 */
const auth = require('../server/auth');
const credits = require('../server/credits');
const store = require('../server/store');

/** 邮箱索引缺失时的兜底：扫一遍 user:* 找回账号，并顺手补建索引 */
async function findUserByScan(email) {
  if (!store.hasRest()) return null;
  const keys = await store.scan('user:*', 200);
  const want = String(email).toLowerCase();
  for (let i = 0; i < keys.length; i++) {
    const rec = await store.getJson(keys[i]);
    if (rec && String(rec.email || '').toLowerCase() === want) {
      await store.setJson('idx:email:' + want, rec.sub); // 补建索引
      return rec;
    }
  }
  return null;
}

function zen(t) {
  const d = new Date(t);
  if (isNaN(d.getTime())) return String(t);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function sign(n) {
  return (n > 0 ? '+' : '') + n;
}

function kindOf(e) {
  if (e.meta && e.meta.kind === 'refund') return '退款';
  if (e.type === 'topup') return '充值/补偿';
  if (e.type === 'spend') return '消费';
  return e.type;
}

async function main() {
  const target = String(process.argv[2] || '').trim();
  const limit = Math.min(200, Math.max(1, Number(process.argv[3]) || 50));

  if (!target) {
    console.log('用法: KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/account-show.js <email 或 sub> [条数]');
    console.log('想看库里有哪些账号：node scripts/kv-inspect.js');
    process.exit(1);
    return;
  }

  if (!store.hasRest()) {
    console.log('⚠️  未设置 KV_REST_API_URL / KV_REST_API_TOKEN，无法查看线上数据');
    process.exit(1);
    return;
  }

  let sub = target;
  let healed = false;
  let profile = null;

  if (target.indexOf('@') !== -1) {
    sub = await auth.findByEmail(target);
    if (!sub) {
      const rec = await findUserByScan(target);
      if (rec && rec.sub) { sub = rec.sub; healed = true; }
    }
  }

  if (!sub) {
    console.log('没找到这个邮箱对应的账号（可能还没登录过站点）。');
    console.log('确认一下：KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/kv-inspect.js');
    return;
  }

  profile = (await auth.getUser(sub)) || { sub: sub };
  const balance = await credits.balanceUser(sub);
  const raw = await credits.ledgerUser(sub, limit);
  const ledger = (raw || []).slice().reverse(); // 最新的排在最上面

  console.log('========================================');
  console.log('账号: ' + (profile.email || '(无邮箱)') + '   ' + (profile.name || ''));
  console.log('sub : ' + sub);
  if (healed) console.log('（邮箱索引原本缺失，已补建）');
  console.log('当前余额: ' + balance + ' 积分  (≈ $' + (balance * 0.005).toFixed(2) + ')');
  console.log('========================================');

  if (!ledger.length) {
    console.log('暂无流水');
    return;
  }

  let inSum = 0, outSum = 0, refundSum = 0;
  ledger.forEach(function (e) {
    const isRefund = !!(e.meta && e.meta.kind === 'refund');
    if (e.amount > 0) { if (isRefund) refundSum += e.amount; else inSum += e.amount; }
    else outSum += -e.amount;

    console.log(
      zen(e.t) + '  ' +
      (isRefund ? '↩退款' : (e.amount > 0 ? '＋入账' : '－消费')) + '  ' +
      String(sign(e.amount)).padStart(6) + '  ' +
      ('余额 ' + e.balance).padEnd(11) + '  ' +
      kindOf(e) + '  ' + (e.note || '')
    );
  });

  console.log('----------------------------------------');
  console.log('入账合计: +' + inSum + '   消费合计: -' + outSum + '   退款合计: +' + refundSum);
  console.log('共 ' + ledger.length + ' 条（最多显示 ' + limit + ' 条）');
}

main().catch(function (e) {
  console.error('失败:', e && e.message ? e.message : e);
  process.exit(1);
});
