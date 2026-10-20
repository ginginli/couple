/**
 * 轻量签名：防止 /api/ai/status 被当成公开的代理去轮询别人的任务 id。
 * 生产环境建议再加 IP 限流与单用户并发限制。
 */
const crypto = require('crypto');

function secret() {
  return process.env.INTERNAL_SECRET || 'dev-insecure-secret';
}

function sign(payload) {
  const raw = String(payload);
  const mac = crypto.createHmac('sha256', secret()).update(raw).digest('hex').slice(0, 32);
  return mac;
}

function createToken(payload) {
  return sign(payload);
}

function verify(payload, token) {
  if (!token) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { createToken, verify };
