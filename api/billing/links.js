/**
 * GET /api/billing/links
 * 公开接口：返回各档的 Creem 支付地址（供前端挂 data-creem-checkout 用）
 * 只暴露支付页地址，不含任何密钥
 */
const billing = require('../../server/billing');
const credits = require('../../server/credits');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const packs = {};
  Object.keys(credits.PACKS).forEach(function (k) {
    const url = billing.paymentLink(k);
    packs[k] = url ? { url: url, credits: credits.PACKS[k].credits, usd: credits.PACKS[k].usd } : null;
  });

  return res.status(200).json({ ok: true, enabled: billing.enabled(), packs: packs });
};
