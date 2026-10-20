/**
 * GET /api/account/me
 * 当前登录用户 + 积分余额 + 最近流水 + 前端需要的公开配置
 * 未登录也返回 200（user: null），方便前端统一处理
 */
const auth = require('../../server/auth');
const credits = require('../../server/credits');
const billing = require('../../server/billing');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const u = auth.readUser(req);
  if (!u) {
    return res.status(200).json({
      ok: true,
      user: null,
      credits: null,
      ledger: [],
      config: { googleClientId: auth.GOOGLE_CLIENT_ID || null, billingEnabled: billing.enabled() }
    });
  }

  const profile = (await auth.getUser(u.sub)) || u;
  return res.status(200).json({
    ok: true,
    user: { sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture },
    credits: await credits.balanceUser(u.sub),
    ledger: await credits.ledgerUser(u.sub, 20),
    config: { googleClientId: auth.GOOGLE_CLIENT_ID || null, billingEnabled: billing.enabled() }
  });
};
