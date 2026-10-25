/**
 * GET  /api/account/me
 * 当前登录用户 + 积分余额 + 最近流水 + 前端需要的公开配置
 * 未登录也返回 200（user: null），方便前端统一处理
 *
 * POST /api/account/me?action=reconcile
 * 补查当前用户未完成的渲染任务（成功落库、失败退款）
 * 与 me 合并为同一个函数，避免超过 Vercel Hobby 的 12 个函数上限
 */
const auth = require('../../server/auth');
const credits = require('../../server/credits');
const billing = require('../../server/billing');
const works = require('../../server/works');
const reconcile = require('../../server/reconcile');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    if ((req.query && req.query.action) !== 'reconcile') {
      return res.status(400).json({ ok: false, error: 'unknown_action' });
    }
    const su = auth.readUser(req);
    if (!su) return res.status(401).json({ ok: false, error: 'login_required' });
    const out = await reconcile.reconcileUser(su.sub);
    return res.status(200).json(Object.assign({ ok: true }, out));
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const u = auth.readUser(req);
  if (!u) {
    return res.status(200).json({
      ok: true,
      user: null,
      credits: null,
      ledger: [],
      works: [],
      config: { googleClientId: auth.GOOGLE_CLIENT_ID || null, billingEnabled: billing.enabled() }
    });
  }

  const profile = (await auth.getUser(u.sub)) || u;
  const claimed = await billing.claimPending(profile.email, u.sub);
  return res.status(200).json({
    ok: true,
    user: { sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture },
    credits: await credits.balanceUser(u.sub),
    ledger: await credits.ledgerUser(u.sub, 20),
    works: await works.list(u.sub, 20),
    claimed: claimed && claimed.credits ? claimed.credits : 0,
    config: { googleClientId: auth.GOOGLE_CLIENT_ID || null, billingEnabled: billing.enabled() }
  });
};
