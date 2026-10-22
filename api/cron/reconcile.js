/**
 * GET /api/cron/reconcile
 * 定时补偿扫描：处理所有用户尚未终态的渲染任务。
 *
 * 鉴权：Authorization: Bearer <CRON_SECRET>（Vercel Cron 会自动带上），
 *       或 x-cron-secret；没配 CRON_SECRET 时退化为 ADMIN_TOKEN。
 */
const reconcile = require('../../server/reconcile');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.CRON_SECRET || process.env.ADMIN_TOKEN;
  if (!secret) {
    return res.status(503).json({ ok: false, error: 'cron secret not configured' });
  }
  const header = req.headers.authorization || '';
  const provided = header.indexOf('Bearer ') === 0
    ? header.slice(7).trim()
    : String(req.headers['x-cron-secret'] || '');
  if (provided !== secret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    const out = await reconcile.reconcileAll(10);
    console.log(JSON.stringify(Object.assign({ event: 'reconcile_cron' }, out)));
    return res.status(200).json(Object.assign({ ok: true }, out));
  } catch (e) {
    console.error(JSON.stringify({ event: 'reconcile_cron_failed', error: e.message }));
    return res.status(500).json({ ok: false, error: e.message });
  }
};
