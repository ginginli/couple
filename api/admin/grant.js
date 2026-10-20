/**
 * 后台补发 / 查询（需 ADMIN_TOKEN）
 *
 * GET  /api/admin/grant?action=list           列出待认领的付款邮箱（找不到账号的订单）
 * POST /api/admin/grant  { email | sub, credits, note }
 *      把积分补发给指定账号；只给 email 时会自动解析出账号
 *
 * 鉴权：header `x-admin-token: <ADMIN_TOKEN>` 或 query ?token=
 * 未配置 ADMIN_TOKEN 时一律 501（避免误开放）
 */
const auth = require('../../server/auth');
const credits = require('../../server/credits');
const billing = require('../../server/billing');

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

  // 查询待认领
  if (req.method === 'GET' || (req.body && req.body.action === 'list')) {
    return res.status(200).json({ ok: true, pending: await billing.listPending() });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const creditsNum = Number(body.credits);
  if (!creditsNum || creditsNum <= 0) return res.status(400).json({ ok: false, error: 'credits must be > 0' });

  let sub = body.sub || null;
  if (!sub && body.email) sub = await auth.findByEmail(body.email);
  if (!sub) return res.status(404).json({ ok: false, error: 'user_not_found', hint: '该邮箱还没注册，积分会等他登录后自动认领' });

  const out = await credits.grantUser(sub, creditsNum, body.note || 'admin_grant', { by: 'admin', orderId: body.orderId || null });
  console.log(JSON.stringify({ event: 'admin_grant', sub: sub, credits: creditsNum, note: body.note || '' }));
  return res.status(200).json({ ok: true, sub: sub, balance: out.balance });
};
