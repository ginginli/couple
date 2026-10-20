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
const auth = require('./auth');
const credits = require('./credits');
const store = require('./store');

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

// 有 API key 走动态结账（可带 metadata）；只有 product id 也能用官方支付链接
function enabled() {
  return !!(API_KEY || PRODUCTS.starter || PRODUCTS.popular || PRODUCTS.pro);
}

/** 官方支付链接：https://www.creem.io/payment/<product_id> */
function paymentLink(packKey) {
  const pid = PRODUCTS[packKey];
  return pid ? 'https://www.creem.io/payment/' + pid : null;
}

/** 取某档的结账地址：优先 API 动态创建，否则回落到官方静态链接 */
function linkFor(packKey) {
  const l = paymentLink(packKey);
  return { ok: !!l, url: l, mode: API_KEY ? 'api' : 'link' };
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
  let userId = meta.userId || obj.userId || null;

  // 链接/embed 支付无法携带 metadata：用付款邮箱反查账号
  if (!userId) {
    const email = (obj.customer && obj.customer.email) || obj.customer_email || obj.email || null;
    if (email) userId = await auth.findByEmail(email);
  }
  const pack = credits.PACKS[packKey] || null;
  if (!pack) return { ok: false, error: 'unknown_pack' };

  const keyId = orderId || ('evt:' + (event.eventId || Date.now()));
  const done = await credits.orderDone(keyId);
  if (done) {
    if (done.granted) return { ok: true, duplicate: true, balance: done.balance };
    if (done.parked) return { ok: true, duplicate: true, pending: true };
  }

  // 匹配不到账号：不丢单，寄存到付款邮箱名下，等该邮箱登录时自动认领
  if (!userId) {
    const email = (obj.customer && obj.customer.email) || obj.customer_email || obj.email || null;
    if (!email) return { ok: false, error: 'no_user_no_email', hint: '既无 userId 也无付款邮箱，需人工处理' };
    await parkClaim(email, { orderId: keyId, packKey: packKey, credits: pack.credits });
    return { ok: true, pending: true, email: email, credits: pack.credits, hint: '已寄存，待该邮箱登录后自动入账' };
  }

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

/** 寄存：付款邮箱暂时找不到账号，先把积分挂在邮箱名下 */
async function parkClaim(email, info) {
  const key = 'claim:' + String(email).toLowerCase();
  const prev = (await store.getJson(key)) || { email: String(email).toLowerCase(), orders: [], credits: 0 };
  if (prev.orders.indexOf(info.orderId) !== -1) return prev;
  prev.orders.push(info.orderId);
  prev.credits += info.credits;
  prev.packs = (prev.packs || []).concat(info.packKey);
  prev.updatedAt = new Date().toISOString();
  await store.setJson(key, prev);
  await store.push('claims:index', String(email).toLowerCase());
  await credits.markOrder(info.orderId, {
    orderId: info.orderId, email: email, packKey: info.packKey, credits: info.credits,
    granted: false, parked: true, at: new Date().toISOString()
  });
  console.log(JSON.stringify({ event: 'claim_parked', email: email, credits: info.credits, orderId: info.orderId }));
  return prev;
}

/** 认领：该邮箱登录后，把寄存的积分一次性入账（按订单逐个发，幂等） */
async function claimPending(email, sub) {
  if (!email || !sub) return { claimed: 0, credits: 0 };
  const key = 'claim:' + String(email).toLowerCase();
  const rec = await store.getJson(key);
  if (!rec || !rec.orders || !rec.orders.length) return { claimed: 0, credits: 0 };

  let total = 0;
  let balance = null;
  for (const oid of rec.orders) {
    const ord = await credits.orderDone(oid);
    if (ord && ord.granted) continue;
    const info = ord || { credits: 0 };
    const amount = info.credits || Math.round(rec.credits / rec.orders.length);
    const g = await credits.grantUser(sub, amount, 'claim:' + (info.packKey || 'purchase'), { orderId: oid, fromEmail: email });
    if (g.ok) {
      balance = g.balance;
      total += amount;
      await credits.markOrder(oid, Object.assign({}, info, { granted: true, parked: false, userId: sub, claimedAt: new Date().toISOString(), balance: g.balance }));
    }
  }
  await store.del(key);
  const idx = await store.list('claims:index', 200);
  await store.del('claims:index');
  idx.filter(function (e) { return e !== String(email).toLowerCase(); })
     .forEach(async function (e) { await store.push('claims:index', e); });
  console.log(JSON.stringify({ event: 'claim_granted', email: email, sub: sub, credits: total }));
  return { claimed: rec.orders.length, credits: total, balance: balance };
}

/** 列出所有待认领的邮箱（人工跟进用，配合 /api/admin/grant） */
async function listPending() {
  const emails = (await store.list('claims:index', 200)) || [];
  const seen = {};
  const out = [];
  for (const e of emails) {
    if (seen[e]) continue;
    seen[e] = 1;
    const rec = await store.getJson('claim:' + e);
    if (rec && rec.credits) out.push({ email: rec.email, credits: rec.credits, orders: rec.orders, updatedAt: rec.updatedAt });
  }
  return out;
}

const COMPLETED_EVENTS = ['checkout.completed', 'order.completed', 'order.paid', 'subscription.active'];

module.exports = {
  enabled,
  paymentLink,
  linkFor,
  parkClaim,
  claimPending,
  listPending,
  PRODUCTS,
  createCheckout,
  verifySignature,
  handleCompleted,
  COMPLETED_EVENTS
};
