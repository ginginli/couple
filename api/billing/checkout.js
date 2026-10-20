/**
 * POST /api/billing/checkout  { packKey: 'starter' | 'popular' | 'pro' }
 * 创建 Creem 结账会话，返回跳转 URL；未配置收款时返回 501
 */
const auth = require('../../server/auth');
const billing = require('../../server/billing');
const credits = require('../../server/credits');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const user = await auth.requireUser(req, res);
  if (!user) return;

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const packKey = body.packKey || 'popular';
  if (!credits.PACKS[packKey]) return res.status(400).json({ ok: false, error: 'unknown_pack' });

  if (!billing.enabled()) {
    return res.status(501).json({ ok: false, error: 'billing_not_configured' });
  }

  try {
    const origin = (req.headers && req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] + '://' + req.headers.host : null)
      || 'https://zombie-couple.xyz';
    const out = await billing.createCheckout({ packKey, userId: user.sub, email: user.email, origin });
    if (!out.ok) return res.status(502).json({ ok: false, error: out.error, details: out.raw || null });
    await credits.markOrder('checkout:' + out.checkoutId, { userId: user.sub, packKey: packKey, granted: false });
    return res.status(200).json({ ok: true, url: out.url, checkoutId: out.checkoutId, credits: out.credits });
  } catch (e) {
    console.error(JSON.stringify({ event: 'checkout_error', error: e.message }));
    return res.status(502).json({ ok: false, error: e.message });
  }
};
