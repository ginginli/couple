#!/usr/bin/env node
/**
 * 给自己（或任意邮箱）加积分 —— 本地直连 KV，不需要线上 ADMIN_TOKEN / 不需要部署
 *
 * 用法：
 *   KV_REST_API_URL=https://xxx.upstash.io KV_REST_API_TOKEN=xxx \
 *     node scripts/grant-credits.js you@gmail.com 1000
 *
 *   # 也可以直接按 sub 发（sub 形如 g:1234567890）
 *   node scripts/grant-credits.js g:1234567890 1000
 *
 * 说明：
 *   - 邮箱已登录过 → 直接入账，打印新余额
 *   - 索引缺失（早于邮箱索引功能登录的账号）→ 扫 KV 找回账号、补建索引后再入账
 *   - 邮箱确实还没注册 → 走「寄存」，他用这个邮箱登录时自动到账（不会丢）
 *   - 没带 KV 环境变量时只会写内存，打印提醒，不会真的写进去
 */
const auth = require('../server/auth');
const credits = require('../server/credits');
const billing = require('../server/billing');
const store = require('../server/store');

/** 邮箱索引缺失时的兜底：扫一遍 user:* 找回账号，并顺手补建索引 */
async function findUserByScan(email) {
  if (!store.hasRest()) return null;
  const keys = await store.scan('user:*', 200);
  const want = String(email).toLowerCase();
  for (let i = 0; i < keys.length; i++) {
    const rec = await store.getJson(keys[i]);
    if (rec && String(rec.email || '').toLowerCase() === want) {
      await store.setJson('idx:email:' + want, rec.sub); // 补建索引
      return rec;
    }
  }
  return null;
}

async function main() {
  const target = String(process.argv[2] || '').trim();
  const amount = Number(process.argv[3] || 1000);
  const note = process.argv[4] || 'local_grant';

  if (!target || !amount || amount <= 0) {
    console.log('用法: KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/grant-credits.js <email 或 sub> <credits> [note]');
    process.exit(1);
    return;
  }

  const live = store.hasRest();
  if (!live) console.log('⚠️  未设置 KV_REST_API_URL / KV_REST_API_TOKEN —— 本次只写内存，不会生效');

  // 直接给了 sub
  if (target.indexOf('@') === -1) {
    const out = await credits.grantUser(target, amount, note, { by: 'local_script' });
    console.log(JSON.stringify({ ok: true, mode: 'grant_by_sub', sub: target, granted: amount, balance: await credits.balanceUser(target), out: out }, null, 2));
    return;
  }

  let sub = await auth.findByEmail(target);
  let healed = false;

  if (!sub) {
    const rec = await findUserByScan(target);
    if (rec && rec.sub) { sub = rec.sub; healed = true; }
  }

  if (sub) {
    const out = await credits.grantUser(sub, amount, note, { by: 'local_script' });
    console.log(JSON.stringify({
      ok: true, mode: 'grant', email: target, sub: sub,
      indexRebuilt: healed, granted: amount, balance: await credits.balanceUser(sub), out: out
    }, null, 2));
    if (live) console.log('✅ 已入账，回站点刷新（或切一下标签页再切回来）即可看到余额');
    return;
  }

  // 确实还没注册：寄存到邮箱名下，登录即自动认领
  const orderId = 'local:' + Date.now();
  await billing.parkClaim(target, { orderId: orderId, packKey: 'manual', credits: amount });
  console.log(JSON.stringify({
    ok: true, mode: 'parked', email: target, credits: amount,
    hint: 'KV 里没有这个邮箱的账号（可能登录时 KV 未连通，或用了另一个 Google 账号）。已寄存，用该邮箱登录时会自动入账。想确认库里有哪些账号：node scripts/kv-inspect.js'
  }, null, 2));
}

main().catch(function (e) {
  console.error('失败:', e && e.message ? e.message : e);
  process.exit(1);
});
