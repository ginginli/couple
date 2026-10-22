/**
 * POST /api/billing/paypal-webhook —— PayPal 支付回调，验签后幂等加积分
 *
 * 环境变量：
 *   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET   REST app 凭据（Live）
 *   PAYPAL_WEBHOOK_ID                        Webhook 详情页里的 Webhook ID
 *   PAYPAL_API_BASE                          可选，默认 https://api-m.paypal.com
 *
 * 事件：PAYMENT.CAPTURE.COMPLETED
 *   金额 → 积分包（$7.90 / $9.90 / $15.90）
 *   账号：custom_id 优先，其次付款邮箱反查；查不到就寄存到该邮箱名下
 */
const auth = require('../../server/auth');
const credits = require('../../server/credits');
const billing = require('../../server/billing');
const http = require('../../server/http');

const API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';

// 关闭 Vercel 自动解析，保留原始字节供验签
module.exports.config = { api: { bodyParser: false } };

let cachedToken = null; // { value, exp }

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
    if (typeof req.body === 'string') return resolve(req.body);
    if (typeof req.body === 'object' && req.body !== null) return resolve(JSON.stringify(req.body));
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); });
    req.on('error', reject);
  });
}

async function getAccessToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.value;
  const basic = Buffer.from(
    process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET
  ).toString('base64');
  const res = await fetch(API_BASE + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const text = await res.text();
  if (!res.ok) throw new Error('paypal_auth_failed: ' + res.status + ' ' + text.slice(0, 200));
  const json = JSON.parse(text);
  cachedToken = { value: json.access_token, exp: Date.now() + (json.expires_in || 300) * 1000 };
  return cachedToken.value;
}

/** 用 PayPal 官方接口验签，避免伪造回调 */
async function verifySignature(headers, raw, event) {
  const token = await getAccessToken();
  const body = {
    transmission_id: headers['paypal-transmission-id'],
    transmission_time: headers['paypal-transmission-time'],
    cert_url: headers['paypal-cert-url'],
    auth_algo: headers['paypal-auth-algo'],
    transmission_sig: headers['paypal-transmission-sig'],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: event
  };
  const out = await http.post(API_BASE + '/v1/notifications/verify-webhook-signature', {
    Authorization: 'Bearer ' + token
  }, body, 15000, 1);
  return out && out.verification_status === 'SUCCESS';
}

function packByAmount(value, currency) {
  if (String(currency || '').toUpperCase() !== 'USD') return null;
  const usd = Number(value);
  const keys = Object.keys(credits.PACKS);
  for (let i = 0; i < keys.length; i++) {
    const pack = credits.PACKS[keys[i]];
    if (Math.abs(pack.usd - usd) < 0.01) return { key: keys[i], pack: pack };
  }
  return null;
}

async function handleCompleted(event) {
  const r = event.resource || {};
  const orderId = r.id; // capture id，作为幂等键
  if (!orderId) return { ok: false, error: 'no_capture_id' };

  const done = await credits.orderDone(orderId);
  if (done) return { ok: true, duplicate: true, balance: done.balance, pending: !!done.parked };

  const matched = packByAmount(r.amount && r.amount.value, r.amount && r.amount.currency_code);
  if (!matched) {
    console.log(JSON.stringify({ event: 'paypal_unknown_amount', amount: r.amount, id: orderId }));
    return { ok: true, ignored: 'unknown_amount' };
  }

  const customId = r.custom_id || r.custom || null;
  const payerEmail = (r.payer && r.payer.email_address) || null;

  let userId = null;
  if (customId && String(customId).indexOf('@') !== -1) {
    userId = await auth.findByEmail(customId);           // 买家在备注里填了登录邮箱
  } else if (customId) {
    userId = await auth.getUser(customId) ? customId : null; // 未来 Smart Buttons 可直接传 sub
  }
  if (!userId && payerEmail) userId = await auth.findByEmail(payerEmail);

  const note = 'paypal:' + matched.key + ':' + orderId;
  if (!userId) {
    if (!payerEmail) return { ok: false, error: 'no_user_no_email' };
    await billing.parkClaim(payerEmail, {
      orderId: orderId, packKey: matched.key, credits: matched.pack.credits
    });
    return { ok: true, pending: true, email: payerEmail, credits: matched.pack.credits };
  }

  const g = await credits.grantUser(userId, matched.pack.credits, note, {
    orderId: orderId, packKey: matched.key, amountUsd: matched.pack.usd, payerEmail: payerEmail
  });
  await credits.markOrder(orderId, {
    orderId: orderId,
    userId: userId,
    packKey: matched.key,
    credits: matched.pack.credits,
    granted: true,
    balance: g.balance,
    payerEmail: payerEmail,
    at: new Date().toISOString()
  });
  return { ok: true, granted: matched.pack.credits, balance: g.balance, userId: userId };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET || !process.env.PAYPAL_WEBHOOK_ID) {
    return res.status(501).json({ ok: false, error: 'paypal_not_configured' });
  }

  const raw = await readRawBody(req);
  let event = {};
  try {
    event = JSON.parse(raw);
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'bad_json' });
  }

  let valid = false;
  try {
    valid = await verifySignature(req.headers, raw, event);
  } catch (e) {
    console.error(JSON.stringify({ event: 'paypal_verify_error', error: e.message }));
    return res.status(500).json({ ok: false, error: 'verify_error' });
  }
  if (!valid) {
    console.error(JSON.stringify({ event: 'paypal_bad_signature' }));
    return res.status(400).json({ ok: false, error: 'bad_signature' });
  }

  const type = event.event_type || '';
  if (type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return res.status(200).json({ ok: true, ignored: type });
  }

  try {
    const out = await handleCompleted(event);
    console.log(JSON.stringify({ event: 'paypal_webhook', type: type, result: out }));
    return res.status(200).json({ ok: true, result: out });
  } catch (e) {
    console.error(JSON.stringify({ event: 'paypal_grant_error', error: e.message }));
    return res.status(500).json({ ok: false, error: e.message });
  }
};
