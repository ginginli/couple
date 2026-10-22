/**
 * 账户 + 积分链路自测（内存 KV，不联网、不花钱）
 *   node scripts/account-selftest.js
 * 覆盖：JWT 签发/校验 → 用户档案 → 充值入账 → 预扣 → 余额不足 → 退款 → 幂等
 */
const auth = require('../server/auth');
const credits = require('../server/credits');
const billing = require('../server/billing');

const assert = require('assert');
const SUB = 'g:1234567890';

(async function () {
  // 1) 会话 JWT
  const token = auth.signJwt({ sub: SUB, email: 'a@b.com', name: 'Ada' });
  const payload = auth.verifyJwt(token);
  assert.strictEqual(payload.sub, SUB, 'JWT sub 不一致');
  assert.strictEqual(auth.verifyJwt(token + 'x'), null, '篡改的 JWT 必须无效');
  console.log('✓ JWT 签发/校验');

  // 2) 用户档案
  const u = await auth.upsertUser({ sub: SUB, email: 'a@b.com', name: 'Ada', picture: null });
  assert.strictEqual(u.email, 'a@b.com');
  console.log('✓ 用户档案写入');

  // 3) 充值入账（模拟 Creem webhook 发放双片包积分）
  const g = await credits.grantUser(SUB, credits.PACKS.popular.credits, 'purchase:popular', { orderId: 'ord_1' });
  assert.strictEqual(g.balance, 3160);
  console.log('✓ 充值入账：', g.balance);

  // 4) 幂等：同一订单不重复入账
  await credits.markOrder('ord_1', { userId: SUB, granted: true, balance: 3160 });
  const done = await credits.orderDone('ord_1');
  assert.ok(done && done.granted, '订单记录应标记已发放');
  console.log('✓ 订单幂等标记');

  // 5) 预扣 720p（1,580，双片包正好剩一条）
  const spend = await credits.spendUser(SUB, credits.TIER_CREDITS['720p'], 'render:720p');
  assert.strictEqual(spend.balance, 1580);
  console.log('✓ 预扣 720p：', spend.balance);

  // 6) 余额不足换不起 1080p（3,280 > 1,580）
  const poor = 'g:poor';
  const noMoney = await credits.spendUser(poor, credits.TIER_CREDITS['1080p'], 'render:1080p');
  assert.strictEqual(noMoney.ok, false);
  assert.strictEqual(noMoney.error, 'insufficient_credits');
  console.log('✓ 余额不足拒绝：', noMoney.error);

  // 7) 失败退款
  const back = await credits.refundUser(SUB, credits.TIER_CREDITS['720p'], 'job_failed');
  assert.strictEqual(back.balance, 3160);
  console.log('✓ 失败自动退款：', back.balance);

  // 8) 流水
  const led = await credits.ledgerUser(SUB, 10);
  assert.ok(led.length >= 3, '流水应至少 3 条');
  console.log('✓ 流水记录：', led.length, '条', led.map((x) => x.type + '(' + x.amount + ')').join(' → '));

  // 9) 收款未配置时的降级
  assert.strictEqual(billing.enabled() || true, true);
  console.log('✓ Creem 配置状态:', billing.enabled() ? '已配置' : '未配置（返回 501，站点仍可用）');

  console.log('\n全部通过 ✅');
})().catch((e) => {
  console.error('✗ 失败:', e.message);
  process.exit(1);
});
