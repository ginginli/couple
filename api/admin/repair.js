/**
 * 后台补跑卡住的渲染任务（需 ADMIN_TOKEN）
 *
 * GET/POST /api/admin/repair?jobId=<id>[&provider=atlas]
 *      强制复查指定任务：成功落作品库，失败/过期自动退款
 * GET/POST /api/admin/repair
 *      扫描所有未终态订单，补跑到终态（不依赖待查列表）
 *
 * 鉴权：header `x-admin-token: <ADMIN_TOKEN>` 或 query ?token=
 */
const reconcile = require('../../server/reconcile');
const adapter = require('../../server/provider-adapter');
const credits = require('../../server/credits');

function authorized(req) {
  const secret = process.env.ADMIN_TOKEN || '';
  if (!secret) return false;
  const got = (req.headers && req.headers['x-admin-token']) || (req.query && req.query.token) || '';
  return String(got) === secret;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_TOKEN) return res.status(501).json({ ok: false, error: 'admin_disabled' });
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'bad_token' });
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const jobId = String((req.query && req.query.jobId) || body.jobId || '').trim();
  const provider = String((req.query && req.query.provider) || body.provider || adapter.PROVIDER);

  try {
    if (jobId) {
      const orderKey = 'job:' + provider + ':' + jobId;
      const state = await reconcile.processKey(orderKey, { force: true });
      const rec = await credits.orderDone(orderKey);
      console.log(JSON.stringify({ event: 'admin_repair', jobKey: orderKey, state, userId: rec && rec.userId }));
      return res.status(200).json({
        ok: true,
        jobKey: orderKey,
        state: state,
        order: rec ? {
          userId: rec.userId,
          cost: rec.cost,
          resolution: rec.resolution,
          completed: !!rec.completed,
          refunded: !!rec.refunded,
          expired: !!rec.expired
        } : null
      });
    }

    const out = await reconcile.repairStuck(20);
    console.log(JSON.stringify(Object.assign({ event: 'admin_repair_scan' }, out)));
    return res.status(200).json(Object.assign({ ok: true }, out));
  } catch (e) {
    console.error(JSON.stringify({ event: 'admin_repair_failed', error: e.message }));
    return res.status(500).json({ ok: false, error: e.message });
  }
};
