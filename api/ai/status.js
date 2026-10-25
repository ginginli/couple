/**
 * GET /api/ai/status?provider=fal&id=<providerJobId>&token=<hmac>
 * 代理轮询（无状态，不依赖数据库）：把状态与结果透传给前端。
 */
const { Readable } = require('stream');
const adapter = require('../../server/provider-adapter');
const tokens = require('../../server/tokens');
const credits = require('../../server/credits');
const works = require('../../server/works');
const reconcile = require('../../server/reconcile');
const auth = require('../../server/auth');

const JOB_RE = /^[a-z0-9-]+:[\w.-]+$/i;

/**
 * GET /api/ai/status?download=1&job=<provider>:<jobId>[&inline=1]
 *
 * 成片下载/播放代理。Atlas 的视频存放在阿里云 OSS（atlas-media 桶），
 * 桶配置了 Referer 防盗链，浏览器直连会被 AccessDenied 拒绝；服务端转发不带 Referer，可正常取流。
 * 与轮询接口合并为一个 Serverless Function，避免超过 Vercel Hobby 的 12 个函数上限。
 *
 * 安全：必须登录，且只能拉取本人作品库中已落库的记录。
 */
async function handleDownload(req, res) {
  const user = await auth.requireUser(req, res);
  if (!user) return;

  const job = String((req.query && req.query.job) || '');
  if (!JOB_RE.test(job)) {
    return res.status(400).json({ ok: false, error: 'bad job id' });
  }

  const list = await works.list(user.sub, works.MAX_WORKS);
  const rec = list.find(function (w) { return w && w.jobId === job && w.videoUrl; });
  if (!rec) {
    return res.status(404).json({ ok: false, error: 'work not found' });
  }

  const headers = {};
  if (req.headers.range) headers.Range = req.headers.range;

  let upstream;
  try {
    upstream = await fetch(rec.videoUrl, { headers: headers, redirect: 'follow' });
  } catch (e) {
    console.error(JSON.stringify({ event: 'download_fetch_error', job: job, error: e.message }));
    return res.status(502).json({ ok: false, error: 'upstream fetch failed' });
  }

  if (!upstream.ok || !upstream.body) {
    console.error(JSON.stringify({ event: 'download_upstream_error', job: job, status: upstream.status }));
    return res.status(502).json({ ok: false, error: 'upstream denied: ' + upstream.status });
  }

  ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']
    .forEach(function (h) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });
  if (!upstream.headers.get('content-type')) res.setHeader('Content-Type', 'video/mp4');

  const inline = String((req.query && req.query.inline) || '') === '1';
  const filename = 'zombie-couple-' + job.replace(/[^\w.-]+/g, '_') + '.mp4';
  res.setHeader('Content-Disposition', (inline ? 'inline' : 'attachment') + '; filename="' + filename + '"');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.status(upstream.status === 206 ? 206 : 200);
  Readable.fromWeb(upstream.body).pipe(res);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  if (req.query && req.query.download) return handleDownload(req, res);

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
