/**
 * 积分账本（方案 A：无登录，用兑换码承载余额）
 *
 * 数据模型（全部在 KV）：
 *   code:<CODE>     -> { code, credits, status, createdAt, sessionId, email }
 *   bal:<CODE>      -> 数字，剩余积分
 *   ledger:<CODE>   -> 流水列表 [{ t, type, amount, balance, note }]
 *   session:<SID>   -> CODE（支付成功页回查 + 幂等）
 */
const store = require('./store');

// 三个积分包：与页面展示一致
// 每包积分都刚好等于它能生成的片子，不留零头：
//   starter 1,580 = 1×720p；popular 3,160 = 2×720p；pro 5,080 = 1×1080p + 1×720p
const PACKS = {
  starter: { credits: 1580, usd: 7.9, label: 'First Bite' },
  popular: { credits: 3160, usd: 9.9, label: 'Double Date' },
  pro: { credits: 5080, usd: 15.9, label: 'Happy Ending' }
};

// 服务端定价：前端传什么都不算，以这里为准（防改价）
// 只卖 720p / 1080p 两档：Atlas 上 480p 与 720p 走的是同一个模型（Kling O3 Std 固定 720P），
// 卖 480p 等于收低价出同样的片子，没有意义
const TIER_CREDITS = { '720p': 1580, '1080p': 3280 };

const TIERS = Object.keys(TIER_CREDITS);

function isTier(res) {
  return TIER_CREDITS[res] != null;
}

/** 未知档位返回 null，由调用方直接拒绝（不要静默折算成 720p） */
function creditsForResolution(res) {
  return TIER_CREDITS[res] != null ? TIER_CREDITS[res] : null;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆字符

function newCode() {
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += '-';
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return 'ZC-' + out;
}

function normalize(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

/** 发放一个新兑换码（支付成功后调用） */
async function issue({ packKey, credits, sessionId, email, amountUsd }) {
  const code = newCode();
  const rec = {
    code,
    packKey: packKey || null,
    credits: credits,
    status: 'new',
    createdAt: new Date().toISOString(),
    sessionId: sessionId || null,
    email: email || null,
    amountUsd: amountUsd || null
  };
  await store.setJson('code:' + code, rec);
  await store.setJson('bal:' + code, credits);
  await store.push('ledger:' + code, {
    t: rec.createdAt,
    type: 'topup',
    amount: credits,
    balance: credits,
    note: packKey || 'purchase'
  });
  if (sessionId) await store.setJson('session:' + sessionId, code);
  return rec;
}

async function bySession(sessionId) {
  if (!sessionId) return null;
  return store.getJson('session:' + sessionId);
}

async function get(code) {
  return store.getJson('code:' + normalize(code));
}

/** 兑换：把码绑定到当前浏览器（同一个码只能兑一次） */
async function redeem(rawCode) {
  const code = normalize(rawCode);
  const rec = await store.getJson('code:' + code);
  if (!rec) return { ok: false, error: 'code_not_found' };
  if (rec.status === 'redeemed') return { ok: false, error: 'code_already_used', balance: await balance(code) };
  rec.status = 'redeemed';
  rec.redeemedAt = new Date().toISOString();
  await store.setJson('code:' + code, rec);
  return { ok: true, code, credits: rec.credits, balance: await balance(code) };
}

async function balance(rawCode) {
  const code = normalize(rawCode);
  const v = await store.getNumber('bal:' + code);
  return v === null ? 0 : v;
}

/** 扣积分：余额不足返回 ok:false，调用方应返回 402 */
async function spend(rawCode, amount, note) {
  const code = normalize(rawCode);
  const rec = await store.getJson('code:' + code);
  if (!rec) return { ok: false, error: 'code_not_found' };
  const cur = await balance(code);
  if (cur < amount) return { ok: false, error: 'insufficient_credits', balance: cur, need: amount };
  const next = await store.addNumber('bal:' + code, -amount);
  await store.push('ledger:' + code, {
    t: new Date().toISOString(),
    type: 'spend',
    amount: -amount,
    balance: next,
    note: note || 'render'
  });
  return { ok: true, balance: next, spent: amount };
}

/** 失败/超时退款 */
async function refund(rawCode, amount, note) {
  const code = normalize(rawCode);
  const rec = await store.getJson('code:' + code);
  if (!rec) return { ok: false, error: 'code_not_found' };
  const next = await store.addNumber('bal:' + code, amount);
  await store.push('ledger:' + code, {
    t: new Date().toISOString(),
    type: 'refund',
    amount: amount,
    balance: next,
    note: note || 'job_failed'
  });
  return { ok: true, balance: next };
}

async function ledger(rawCode, limit) {
  return store.list('ledger:' + normalize(rawCode), limit || 50);
}


/* ---------------- 账号制积分（方案 B）：按 user.sub 记账 ----------------
 * 与上面的兑换码账本并存：码制用于离线发放，账号制用于登录用户。
 * 键： bal:u:<sub> / ledger:u:<sub>
 */
async function balanceUser(sub) {
  if (!sub) return 0;
  const v = await store.getNumber('bal:u:' + sub);
  return v === null ? 0 : v;
}

/** 加积分（充值 / 补偿 / 退款共用） */
async function grantUser(sub, amount, note, meta) {
  if (!sub || !amount) return { ok: false, error: 'bad_args' };
  const next = await store.addNumber('bal:u:' + sub, Number(amount));
  await store.push('ledger:u:' + sub, {
    t: new Date().toISOString(),
    type: 'topup',
    amount: Number(amount),
    balance: next,
    note: note || 'grant',
    meta: meta || null
  });
  return { ok: true, balance: next, granted: Number(amount) };
}

/** 扣积分：余额不足返回 ok:false（调用方回 402） */
async function spendUser(sub, amount, note) {
  if (!sub) return { ok: false, error: 'no_user' };
  const cur = await balanceUser(sub);
  if (cur < amount) return { ok: false, error: 'insufficient_credits', balance: cur, need: amount };
  const next = await store.addNumber('bal:u:' + sub, -Number(amount));
  await store.push('ledger:u:' + sub, {
    t: new Date().toISOString(),
    type: 'spend',
    amount: -Number(amount),
    balance: next,
    note: note || 'render'
  });
  return { ok: true, balance: next, spent: Number(amount) };
}

/** 渲染失败/超时退款 */
async function refundUser(sub, amount, note) {
  return grantUser(sub, Number(amount), note || 'job_failed', { kind: 'refund' });
}

async function ledgerUser(sub, limit) {
  if (!sub) return [];
  return store.list('ledger:u:' + sub, limit || 50);
}

/** 订单幂等：同一笔订单只入账一次 */
async function orderDone(orderId) {
  if (!orderId) return null;
  return store.getJson('order:' + orderId);
}

async function markOrder(orderId, record) {
  await store.setJson('order:' + orderId, record);
  return record;
}

module.exports = {
  PACKS,
  TIER_CREDITS,
  TIERS,
  isTier,
  creditsForResolution,
  issue,
  bySession,
  get,
  redeem,
  balance,
  spend,
  refund,
  ledger,
  normalize,
  // 账号制
  balanceUser,
  grantUser,
  spendUser,
  refundUser,
  ledgerUser,
  orderDone,
  markOrder
};
