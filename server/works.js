/**
 * 用户作品库（服务端持久化）
 *
 * 键：
 *   works:u:<sub>      -> 列表，按生成时间正序追加（读取时反转成最新在前）
 *   work:<provider>:<jobId> -> 单条记录，用于幂等（同一任务只落库一次）
 *
 * 记录字段：jobId / videoUrl / world / resolution / role1 / role2 /
 *           lang / provider / model / creditsCost / createdAt / savedAt
 */
const store = require('./store');

const MAX_WORKS = 30;

/** 上游返回的 URL 可能带空白/反引号/引号，直接拼进 src 会让播放器解析失败 */
function cleanMediaUrl(u) {
  if (typeof u !== 'string') return '';
  const s = u.trim().replace(/^[\s`'"]+|[\s`'"]+$/g, '');
  return /^https?:\/\//i.test(s) ? s : '';
}

/** 落库：同一 jobId 只写一次（轮询成功可能被重复触发） */
async function add(userId, work) {
  if (!userId || !work || !work.jobId || !work.videoUrl) return null;
  work = Object.assign({}, work, { videoUrl: cleanMediaUrl(work.videoUrl) });
  if (!work.videoUrl) return null;
  const doneKey = 'work:' + work.jobId;
  if (await store.getJson(doneKey)) return null;
  const rec = Object.assign({}, work, {
    userId: userId,
    savedAt: new Date().toISOString()
  });
  await store.setJson(doneKey, rec);
  await store.push('works:u:' + userId, rec);
  return rec;
}

/** 失败也落一条记录：用户要能看到「这次请求确实发生了，但失败了」 */
async function addFailed(userId, work) {
  if (!userId || !work || !work.jobId) return null;
  const doneKey = 'work:' + work.jobId;
  if (await store.getJson(doneKey)) return null;
  const rec = Object.assign({}, work, {
    status: 'failed',
    userId: userId,
    savedAt: new Date().toISOString()
  });
  await store.setJson(doneKey, rec);
  await store.push('works:u:' + userId, rec);
  return rec;
}

/** 失败记录（无 videoUrl，带失败原因与退款状态） */
function failedRecord(order, provider, jobId, error, refunded) {
  return {
    jobId: provider + ':' + jobId,
    error: String(error || '').slice(0, 300),
    world: order.world || 'city',
    resolution: order.resolution || '720p',
    role1: order.role1 || 'Image 1',
    role2: order.role2 || 'Image 2',
    lang: order.lang || 'en',
    provider: provider,
    model: order.model || null,
    creditsCost: order.cost || 0,
    refunded: !!refunded,
    createdAt: new Date().toISOString()
  };
}

/** 由订单记录 + provider 结果拼出作品记录（轮询与补偿扫描共用） */
function workRecord(order, provider, jobId, videoUrl) {
  const clean = cleanMediaUrl(videoUrl);
  if (!order || !clean) return null;
  return {
    jobId: provider + ':' + jobId,
    videoUrl: clean,
    world: order.world || 'city',
    resolution: order.resolution || '720p',
    role1: order.role1 || 'Image 1',
    role2: order.role2 || 'Image 2',
    lang: order.lang || 'en',
    provider: provider,
    model: order.model || null,
    creditsCost: order.cost || 0,
    createdAt: new Date().toISOString()
  };
}

/** 最新在前 */
async function list(userId, limit) {
  if (!userId) return [];
  const items = await store.list('works:u:' + userId, limit || MAX_WORKS);
  return items.slice().reverse();
}

module.exports = { add, addFailed, list, workRecord, failedRecord, MAX_WORKS };
