/**
 * POST /api/auth/google  { idToken }
 * 用 Google 签发的 ID token 换本站会话（httpOnly cookie）
 */
const auth = require('../../server/auth');
const credits = require('../../server/credits');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!auth.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ ok: false, error: 'google_login_not_configured' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const idToken = body.idToken || body.credential || '';
  if (!idToken) return res.status(400).json({ ok: false, error: 'idToken is required' });

  let profile = null;
  try {
    profile = await auth.verifyGoogleIdToken(idToken);
  } catch (e) {
    console.error(JSON.stringify({ event: 'google_verify_error', error: e.message }));
  }
  if (!profile) return res.status(401).json({ ok: false, error: 'invalid_google_token' });

  const user = await auth.upsertUser(profile);
  const token = auth.signJwt({ sub: user.sub, email: user.email, name: user.name, picture: user.picture });
  auth.setSessionCookie(res, token);

  return res.status(200).json({
    ok: true,
    user: { sub: user.sub, email: user.email, name: user.name, picture: user.picture },
    credits: await credits.balanceUser(user.sub)
  });
};
