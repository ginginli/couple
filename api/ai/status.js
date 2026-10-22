/**
 * GET /api/ai/status?provider=fal&id=<providerJobId>&token=<hmac>
 * 代理轮询（无状态，不依赖数据库）：把状态与结果透传给前端。
 */
const adapter = require('../../server/provider-adapter');
const tokens = require('../../server/tokens');
const credits = require('../../server/credits');
const works = require('../../server/works');
const reconcile = require('../../server/reconcile');

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
    // 轮询必须带上提交时登记的地址：adapter 只拿 jobId 时无法保证能还原 endpoint
    const orderKey = 'job:' + provider + ':' + id;
    const rec = await credits.orderDone(orderKey);
    const state = await adapter.poll({
      provider: provider,
      providerJobId: id,
      statusUrl: rec && rec.statusUrl,
      resultUrl: rec && rec.resultUrl,
      model: rec && rec.model
    });

    // 渲染失败/取消：按提交时登记的归属自动退积分（幂等）
    let refunded = 0;
    let balance = null;
    if (state.state === 'failed' || state.state === 'canceled') {
      let wasRefunded = !!(rec && rec.refunded);
      if (rec && !rec.refunded && rec.userId) {
        const out = await credits.refundUser(rec.userId, rec.cost, 'job_' + state.state);
        if (out.ok) {
          refunded = rec.cost;
          balance = out.balance;
          wasRefunded = true;
          await credits.markOrder(orderKey, Object.assign({}, rec, {
            refunded: true,
            completed: true,
            refundedAt: new Date().toISOString()
          }));
          await reconcile.untrack(rec.userId, orderKey);
          console.log(JSON.stringify({ event: 'job_refunded', jobId: id, userId: rec.userId, credits: rec.cost }));
        }
      } else if (rec) {
        await reconcile.untrack(rec.userId, orderKey);
      }
      // 失败也在作品库留痕：用户能看到「这次请求失败了」+ 积分是否退回
      if (rec && rec.userId) {
        await works.addFailed(rec.userId, works.failedRecord(
          rec, provider, id, adapter.failureMessage(state.raw), wasRefunded
        ));
      }
    } else if (state.state === 'succeeded') {
      if (rec) balance = await credits.balanceUser(rec.userId);
      // 成功后把成片落进用户作品库（幂等：同一 jobId 只写一次），
      // 否则刷新页面/换设备后前端内存里的作品列表就丢了
      if (rec && rec.userId && state.videoUrl) {
        await works.add(rec.userId, works.workRecord(rec, provider, id, state.videoUrl));
        await credits.markOrder(orderKey, Object.assign({}, rec, {
          completed: true,
          completedAt: new Date().toISOString()
        }));
        await reconcile.untrack(rec.userId, orderKey);
      }
      // 真实成本：Atlas 响应里的 price 才是准的，RATES 只是估算。
      // 带上视频档位与是否有参考视频，方便直接算单价（price / 秒数）
      try {
        const cost = adapter.PROVIDERS[state.provider].estimateCost(
          { duration: (rec && rec.duration) || 13, resolution: rec && rec.resolution },
          { raw: state.raw }
        );
        console.log(JSON.stringify({
          event: 'job_cost', jobId: id, provider: state.provider,
          model: cost.model, resolution: rec && rec.resolution,
          seconds: cost.seconds,
          reportedUsd: cost.reportedUsd,      // Atlas 实收（校准 RATES 用这个）
          estimatedUsd: cost.estimatedUsd,    // 我们的估算
          creditsCharged: rec && rec.cost
        }));
      } catch (e) {
        console.error(JSON.stringify({ event: 'job_cost_failed', jobId: id, error: e.message }));
      }
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
