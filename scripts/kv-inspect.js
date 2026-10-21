#!/usr/bin/env node
/**
 * 看看 KV 里到底存了哪些账号（排错用：为什么「我登录过却说没账号」）
 *
 * 用法：
 *   KV_REST_API_URL=https://xxx.upstash.io KV_REST_API_TOKEN=xxx node scripts/kv-inspect.js
 *
 * 输出：user:* 的 sub / 邮箱 / 余额，以及 idx:email:* 索引是否齐全
 */
const store = require('../server/store');
const credits = require('../server/credits');

async function main() {
  if (!store.hasRest()) {
    console.log('⚠️  未设置 KV_REST_API_URL / KV_REST_API_TOKEN，无法查看线上数据');
    process.exit(1);
    return;
  }

  const userKeys = await store.scan('user:*', 200);
  const idxKeys = await store.scan('idx:email:*', 200);
  const claimKeys = await store.scan('claim:*', 200);

  const users = [];
  for (let i = 0; i < userKeys.length; i++) {
    const rec = await store.getJson(userKeys[i]);
    if (!rec) continue;
    users.push({
      sub: rec.sub,
      email: rec.email || null,
      name: rec.name || null,
      balance: await credits.balanceUser(rec.sub)
    });
  }

  const idx = [];
  for (let i = 0; i < idxKeys.length; i++) {
    const v = await store.getJson(idxKeys[i]);
    idx.push({ email: idxKeys[i].replace('idx:email:', ''), sub: v });
  }

  console.log(JSON.stringify({
    summary: {
      users: users.length,
      emailIndexes: idx.length,
      pendingClaims: claimKeys.length
    },
    users: users,
    emailIndexes: idx,
    pendingClaims: claimKeys
  }, null, 2));

  const missing = users.filter(function (u) {
    return !u.email || !idx.some(function (x) { return String(x.email).toLowerCase() === String(u.email).toLowerCase(); });
  });
  if (missing.length) {
    console.log('\n⚠️  以下账号缺少邮箱索引（早期登录、索引功能上线前建的号）：');
    missing.forEach(function (u) { console.log('   - ' + u.sub + '  ' + (u.email || '(无邮箱)')); });
    console.log('   直接按 sub 发积分即可：node scripts/grant-credits.js ' + missing[0].sub + ' 1000');
  }
}

main().catch(function (e) {
  console.error('失败:', e && e.message ? e.message : e);
  process.exit(1);
});
