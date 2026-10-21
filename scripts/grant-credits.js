#!/usr/bin/env node
/**
 * 给自己（或任意邮箱）加积分 —— 本地直连 KV，不需要线上 ADMIN_TOKEN / 不需要部署
 *
 * 用法：
 *   KV_REST_API_URL=https://xxx.upstash.io KV_REST_API_TOKEN=xxx \
 *     node scripts/grant-credits.js you@gmail.com 1000
 *
 * 说明：
 *   - 该邮箱已登录过 → 直接入账，打印新余额
 *   - 该邮箱还没登录过 → 走「寄存」，他用这个邮箱登录时自动到账（不会丢）
 *   - 没带 KV 环境变量时只会写内存，打印提醒，不会真的写进去
 */
const auth = require('../server/auth');
const credits = require('../server/credits');
const billing = require('../server/billing');

async function main() {
  const email = String(process.argv[2] || '').trim();
  const amount = Number(process.argv[3] || 1000);
  const note = process.argv[4] || 'local_grant';

  if (!email || !amount || amount <= 0) {
    console.log('用法: KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/grant-credits.js <email> <credits> [note]');
    process.exit(1);
    return;
  }

  const live = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!live) console.log('⚠️  未设置 KV_REST_API_URL / KV_REST_API_TOKEN —— 本次只写内存，不会生效');

  const sub = await auth.findByEmail(email);
  if (sub) {
    const out = await credits.grantUser(sub, amount, note, { by: 'local_script' });
    const balance = await credits.balanceUser(sub);
    console.log(JSON.stringify({ ok: true, mode: 'grant', email: email, sub: sub, granted: amount, balance: balance, out: out }, null, 2));
    if (live) console.log('✅ 已入账，回站点刷新（或切一下标签页再切回来）即可看到余额');
    return;
  }

  // 还没登录过：寄存到邮箱名下，登录即自动认领
  const orderId = 'local:' + Date.now();
  await billing.parkClaim(email, { orderId: orderId, packKey: 'manual', credits: amount });
  console.log(JSON.stringify({ ok: true, mode: 'parked', email: email, credits: amount, hint: '该邮箱还没有账号，已寄存；用这个邮箱登录时会自动入账' }, null, 2));
}

main().catch(function (e) {
  console.error('失败:', e && e.message ? e.message : e);
  process.exit(1);
});
