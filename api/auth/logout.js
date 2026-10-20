/** POST /api/auth/logout —— 清除会话 cookie */
const auth = require('../../server/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  auth.clearSessionCookie(res);
  return res.status(200).json({ ok: true });
};
