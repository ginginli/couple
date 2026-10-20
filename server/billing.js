/**
 * 收款（Creem）：创建结账会话 + 校验 webhook + 幂等发放积分
 *
 * 环境变量（Creem 后台 → Developers / API keys）：
 *   CREEM_API_KEY          服务端调用密钥（x-api-key）
 *   CREEM_WEBHOOK_SECRET   webhook 签名密钥
 *   CREEM_PRODUCT_STARTER / _POPULAR / _PRO   三个积分包对应的 Creem product id
 *   CREEM_TEST=1          走测试环境 https://test-api.creem.io
 *
 * 未配置时：API 返回 billing_not_configured，站点仍可正常演示。
 */
const crypto = require('crypto');
const http = require('./http');
const credits = require('./credits');

const API_KEY = process.env.CREEM_API_KEY || '';
const WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET || '';
const BASE = (process.env.CREEM_TEST === '1' || process.env.CREEM_TEST === 'true')
  ? 'https://test-api.creem.io/v1'
  : 'https://api.creem.io/v1';

const PRODUCTS = {
  starter: process.env.CREEM_PRODUCT_STARTER || '',
  popular: process.env.CREEM_PRODUCT_POPULAR || '',
  pro: process.env.CREEM_PRODUCT_PRO || ''
};

function enabled() {
  return !!(API_KEY && (PRODUCTS.starter || PRODUCTS.popular || PRODUCTS.pro));
}

function packKeyByProductId(pid) {
  for (const k of Object.keys(PRODUCTS)) {
    if (PRODUCTS[k] && PRODUCTS[k] === pid) return k;
  }
  return null;
}

/** 创建结账会话 → 返回前台跳转 URL */
async function createCheckout({ packKey, userId, email, origin }) {
  if (!enabled()) return { ok: false, error: 'billing_not_configured' };
  const pack = credits.PACKS[packKey] || credits.PACKS.popular;
  const productId = PRODUCTS[packKey] || PRODUCTS.popular;
  if (!productId) return { ok: false, error: 'product_not_configured' };

  const body = {
    product_id: productId,
    request_id: 'zc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    success_url: (origin || 'https://zombie-couple.xyz') + '/?topup=success',
    metadata: { userId: userId || '', packKey: packKey, credits: String(pack.credits) }
  };
  if (email) body.customer = { email: email };

  const res = await http.post(BASE + '/checkouts', { 'x-api-key': API_KEY }, body, 20000, 1);
  const url = res.checkout_url || res.url || (res.checkout && res.checkout.checkout_url) || null;
  const id = res.id || res.checkout_id || body.request_id;
  return { ok: !!url, url: url, checkoutId: id, packKey: packKey, credits: pack.credits, raw: res };
}

/** 校验 webhook 签名（HMAC-SHA256，容忍 sha256= / creem-signature 两种格式） */
function verifySignature(rawBody, header) {
  if (!WEBHOOK_SECRET) return false;
  const provided = String(header || '').replace(/^sha256=/, '').trim();
  const expect = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expect);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * 处理已完成的订单：幂等发放积分
 * 支持的事件名覆盖 Creem 常见写法，避免版本差异漏单
 */
async function handleCompleted(event) {
  const orderId = event.id || event.checkout_id || (event.object && (event.object.id || event.object.checkout_id)) || null;
  const obj = event.object || event.data || event;
  const meta = obj.metadata || (obj.custom_data) || {};
  const packKey = meta.packKey || packKeyByProductId(obj.product_id || obj.product || (obj.product && obj.product.id));
  const userId = meta.userId || obj.userId || null;
  const pack = credits.PACKS[packKey] || null;

  if (!userId) return { ok: false, error: 'no_user_in_metadata' };
  if (!pack) return { ok: false, error: 'unknown_pack' };

  const keyId = orderId || ('evt:' + (event.eventId || Date.now()));
  const done = await credits.orderDone(keyId);
  if (done && done.granted) return { ok: true, duplicate: true, balance: done.balance };

  const g = await credits.grantUser(userId, pack.credits, 'purchase:' + packKey, {
    orderId: keyId,
    packKey: packKey,
    amountUsd: pack.usd
  });
  await credits.markOrder(keyId, {
    orderId: keyId,
    userId: userId,
    packKey: packKey,
    credits: pack.credits,
    granted: true,
    balance: g.balance,
    at: new Date().toISOString()
  });
  return { ok: true, granted: pack.credits, balance: g.balance, userId: userId };
}

const COMPLETED_EVENTS = ['checkout.completed', 'order.completed', 'order.paid', 'subscription.active'];

module.exports = {
  enabled,
  PRODUCTS,
  createCheckout,
  verifySignature,
  handleCompleted,
  COMPLETED_EVENTS
};
