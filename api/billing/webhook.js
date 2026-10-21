/**
 * POST /api/billing/webhook —— Creem 支付回调，幂等加积分
 * 签名：header `creem-signature` = HMAC-SHA256(rawBody, CREEM_WEBHOOK_SECRET)
 */
const billing = require('../../server/billing');

/** 读取原始 body：关闭自动解析后从流里取，保证签名逐字节一致 */
function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
    if (typeof req.body === 'string') return resolve(req.body);
    if (typeof req.body === 'object' && req.body !== null) {
      // 兜底：平台已解析过（此时验签可能失败，日志会提示）
      return resolve(JSON.stringify(req.body));
    }
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); });
    req.on('error', reject);
  });
}

// 关闭 Vercel 的自动 body 解析，否则拿不到原始字节、签名验不过
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!process.env.CREEM_WEBHOOK_SECRET) {
    return res.status(501).json({ ok: false, error: 'webhook_not_configured' });
  }

  const raw = await readRawBody(req);
  const sig = req.headers['creem-signature'] || req.headers['x-creem-signature'] || '';
  if (!billing.verifySignature(raw, sig)) {
    console.error(JSON.stringify({ event: 'webhook_bad_signature' }));
    return res.status(400).json({ ok: false, error: 'bad_signature' });
  }

  let event = {};
  try {
    event = JSON.parse(raw);
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'bad_json' });
  }

  const type = event.eventType || event.type || event.event || '';
  const isRefund = billing.REFUND_EVENTS.indexOf(type) !== -1;
  if (billing.COMPLETED_EVENTS.indexOf(type) === -1 && !isRefund) {
    return res.status(200).json({ ok: true, ignored: type });
  }

  try {
    const out = isRefund ? await billing.handleRefunded(event) : await billing.handleCompleted(event);
    console.log(JSON.stringify({ event: isRefund ? 'webhook_refund' : 'webhook_grant', type: type, result: out }));
    return res.status(200).json({ ok: true, result: out });
  } catch (e) {
    console.error(JSON.stringify({ event: 'webhook_grant_error', error: e.message }));
    return res.status(500).json({ ok: false, error: e.message });
  }
};
