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

/** 落库：同一 jobId 只写一次（轮询成功可能被重复触发） */
async function add(userId, work) {
  if (!userId || !work || !work.jobId || !work.videoUrl) return null;
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

/** 由订单记录 + provider 结果拼出作品记录（轮询与补偿扫描共用） */
function workRecord(order, provider, jobId, videoUrl) {
  if (!order || !videoUrl) return null;
  return {
    jobId: provider + ':' + jobId,
    videoUrl: videoUrl,
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

module.exports = { add, list, workRecord, MAX_WORKS };
