/**
 * 账户体系：Google 一键登录 → 服务端签发会话 JWT（httpOnly cookie）
 *
 * 数据（Vercel KV，复用 server/store.js）：
 *   user:<sub>       -> { sub, email, name, picture, createdAt, lastLoginAt }
 *   bal:u:<sub>      -> 数字，剩余积分
 *   ledger:u:<sub>   -> 流水 [{ t, type, amount, balance, note }]
 *
 * 环境变量：
 *   GOOGLE_CLIENT_ID   启用 Google 登录（不配则登录入口显示"未配置"）
 *   SESSION_SECRET     会话签名密钥（缺省退回 INTERNAL_SECRET，仅本地自测）
 */
const crypto = require('crypto');
const store = require('./store');

const COOKIE_NAME = 'zc_session';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天
const SECRET = process.env.SESSION_SECRET || process.env.INTERNAL_SECRET || 'dev-insecure-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

/* ---------------- JWT（HMAC-SHA256，零依赖） ---------------- */
function b64u(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(Object.assign({ iat: Math.floor(Date.now() / 1000) }, payload)));
  const sig = crypto.createHmac('sha256', SECRET).update(head + '.' + body).digest();
  return head + '.' + body + '.' + b64u(sig);
}

function verifyJwt(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const expect = b64u(crypto.createHmac('sha256', SECRET).update(parts[0] + '.' + parts[1]).digest());
  const a = Buffer.from(expect);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

/* ---------------- Cookie ---------------- */
function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token) {
  const parts = [
    COOKIE_NAME + '=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + TTL_SECONDS
  ];
  if (process.env.VERCEL_ENV) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [COOKIE_NAME + '=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (process.env.VERCEL_ENV) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

/* ---------------- Google ID token 校验 ---------------- */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || !GOOGLE_CLIENT_ID) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  if (!r.ok) return null;
  const info = await r.json();
  if (!info || info.aud !== GOOGLE_CLIENT_ID) return null;
  if (info.email_verified !== 'true' && info.email_verified !== true) return null;
  return {
    sub: 'g:' + info.sub,
    email: info.email || null,
    name: info.name || (info.email ? info.email.split('@')[0] : 'User'),
    picture: info.picture || null
  };
}

/* ---------------- 用户档案 ---------------- */
async function upsertUser(profile) {
  const key = 'user:' + profile.sub;
  const prev = (await store.getJson(key)) || null;
  const rec = {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    createdAt: (prev && prev.createdAt) || new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  await store.setJson(key, rec);
  return rec;
}

async function getUser(sub) {
  if (!sub) return null;
  return store.getJson('user:' + sub);
}

/** 从请求里读出当前登录用户（不写响应） */
function readUser(req) {
  const jar = parseCookies(req.headers && req.headers.cookie);
  const payload = verifyJwt(jar[COOKIE_NAME]);
  if (!payload || !payload.sub) return null;
  return { sub: payload.sub, email: payload.email || null, name: payload.name || null, picture: payload.picture || null };
}

/** 需要登录：未登录直接回 401 并返回 null */
async function requireUser(req, res) {
  const u = readUser(req);
  if (!u) {
    res.status(401).json({ ok: false, error: 'login_required' });
    return null;
  }
  return u;
}

module.exports = {
  COOKIE_NAME,
  GOOGLE_CLIENT_ID,
  signJwt,
  verifyJwt,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  verifyGoogleIdToken,
  upsertUser,
  getUser,
  readUser,
  requireUser
};
