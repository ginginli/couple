/**
 * GET /api/ai/status?provider=fal&id=<providerJobId>&token=<hmac>
 * 代理轮询（无状态，不依赖数据库）：把状态与结果透传给前端。
 */
const adapter = require('../../server/provider-adapter');
const tokens = require('../../server/tokens');
const credits = require('../../server/credits');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const { provider, id, token } = req.query || {};
  if (!provider || !id) {
    return res.status(400).json({ ok: false, error: 'provider and id are required' });
  }
  if (!tokens.verify(provider + ':' + id, token)) {
    return res.status(401).json({ ok: false, error: 'bad token' });
  }

  try {
    const state = await adapter.poll({ provider: provider, providerJobId: id });

    // 渲染失败/取消：按提交时登记的归属自动退积分（幂等）
    let refunded = 0;
    let balance = null;
    if (state.state === 'failed' || state.state === 'canceled') {
      const rec = await credits.orderDone('job:' + provider + ':' + id);
      if (rec && !rec.refunded && rec.userId) {
        const out = await credits.refundUser(rec.userId, rec.cost, 'job_' + state.state);
        if (out.ok) {
          refunded = rec.cost;
          balance = out.balance;
          await credits.markOrder('job:' + provider + ':' + id, Object.assign({}, rec, { refunded: true, refundedAt: new Date().toISOString() }));
          console.log(JSON.stringify({ event: 'job_refunded', jobId: id, userId: rec.userId, credits: rec.cost }));
        }
      }
    } else if (state.state === 'succeeded') {
      const rec = await credits.orderDone('job:' + provider + ':' + id);
      if (rec) balance = await credits.balanceUser(rec.userId);
    }

    return res.status(200).json({
      ok: true,
      provider: state.provider,
      jobId: state.providerJobId,
      state: state.state,
      videoUrl: state.videoUrl,
      refunded: refunded,
      balance: balance
    });
  } catch (e) {
    console.error(JSON.stringify({ event: 'poll_error', provider: provider, error: e.message }));
    return res.status(502).json({ ok: false, error: e.message, state: 'failed' });
  }
};
