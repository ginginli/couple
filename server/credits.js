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
const PACKS = {
  starter: { credits: 2000, usd: 9.9, label: 'Starter Pack' },
  popular: { credits: 6000, usd: 26.9, label: 'Couple Viral Pack' },
  pro: { credits: 13000, usd: 54.9, label: 'Creator Pro Pack' }
};

// 服务端定价：前端传什么都不算，以这里为准（防改价）
const TIER_CREDITS = { '480p': 350, '720p': 600, '1080p': 1050 };

function creditsForResolution(res) {
  return TIER_CREDITS[res] || TIER_CREDITS['720p'];
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

module.exports = {
  PACKS,
  TIER_CREDITS,
  creditsForResolution,
  issue,
  bySession,
  get,
  redeem,
  balance,
  spend,
  refund,
  ledger,
  normalize
};
