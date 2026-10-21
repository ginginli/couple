#!/usr/bin/env node
/**
 * 给用户退积分 —— 本地直连 KV，不需要线上 ADMIN_TOKEN / 不需要部署
 *
 * 用法：
 *   KV_REST_API_URL=https://xxx.upstash.io KV_REST_API_TOKEN=xxx \
 *     node scripts/refund-credits.js user@gmail.com 600 出片事故
 *
 *   # 也可以直接按 sub 退（sub 形如 g:1234567890）
 *   node scripts/refund-credits.js g:1234567890 600
 *
 * 说明：
 *   - 找到账号 → 入账（流水 type=topup / kind=refund），打印退款前后余额
 *   - 邮箱索引缺失（早期登录的账号）→ 扫 KV 找回、补建索引后退
 *   - 账号还没注册 → 寄存，他登录时自动到账（不会丢）
 *   - 没带 KV 环境变量时只写内存，打印提醒，不会真的写进去
 *
 * 前置：先看清该用户到底该不该退、退多少，例如
 *   KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/kv-inspect.js
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

async function refundBySub(sub, amount, note) {
  const before = await credits.balanceUser(sub);
  const out = await credits.refundUser(sub, amount, note);
  const after = await credits.balanceUser(sub);
  const entries = await credits.ledgerUser(sub, 1);
  const entry = entries && entries[0];
  return { before: before, after: after, out: out, entry: entry };
}

async function main() {
  const target = String(process.argv[2] || '').trim();
  const amount = Number(process.argv[3] || 0);
  const note = process.argv[4] || 'manual_refund';

  if (!target || !amount || amount <= 0) {
    console.log('用法: KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/refund-credits.js <email 或 sub> <credits> [note]');
    console.log('例  : node scripts/refund-credits.js user@gmail.com 600 出片事故');
    process.exit(1);
    return;
  }

  const live = store.hasRest();
  if (!live) console.log('⚠️  未设置 KV_REST_API_URL / KV_REST_API_TOKEN —— 本次只写内存，不会生效');

  // 直接给了 sub
  if (target.indexOf('@') === -1) {
    const r = await refundBySub(target, amount, note);
    console.log(JSON.stringify({ ok: true, mode: 'refund_by_sub', refunded: amount, result: r }, null, 2));
    return;
  }

  let sub = await auth.findByEmail(target);
  let healed = false;

  if (!sub) {
    const rec = await findUserByScan(target);
    if (rec && rec.sub) { sub = rec.sub; healed = true; }
  }

  if (sub) {
    const r = await refundBySub(sub, amount, note);
    console.log(JSON.stringify({
      ok: true, mode: 'refund', email: target, sub: sub,
      indexRebuilt: healed, refunded: amount, result: r
    }, null, 2));
    if (live) console.log('✅ 已退款 ' + amount + ' 积分（' + r.before + ' → ' + r.after + '），用户刷新页面即可看到');
    return;
  }

  // 确实还没注册：寄存，登录即自动入账
  const orderId = 'localrefund:' + Date.now();
  await billing.parkClaim(target, { orderId: orderId, packKey: 'refund', credits: amount });
  console.log(JSON.stringify({
    ok: true, mode: 'parked', email: target, refunded: amount,
    hint: 'KV 里没有这个邮箱的账号，已寄存，用该邮箱登录时会自动入账。想确认库里有哪些账号：node scripts/kv-inspect.js'
  }, null, 2));
}

main().catch(function (e) {
  console.error('失败:', e && e.message ? e.message : e);
  process.exit(1);
});
