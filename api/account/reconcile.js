/**
 * POST /api/account/reconcile
 * 登录用户回到站点时，补查自己尚未终态的渲染任务：
 * 成功 -> 落作品库；失败 -> 自动退款。
 * 前端在登录/首次加载后调用一次，然后重新拉取作品。
 */
const auth = require('../../server/auth');
const reconcile = require('../../server/reconcile');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const user = await auth.requireUser(req, res);
  if (!user) return;

  try {
    const out = await reconcile.reconcileUser(user.sub, 3);
    return res.status(200).json(Object.assign({ ok: true }, out));
  } catch (e) {
    console.error(JSON.stringify({ event: 'reconcile_user_failed', userId: user.sub, error: e.message }));
    return res.status(500).json({ ok: false, error: e.message });
  }
};
