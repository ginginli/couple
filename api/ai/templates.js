/**
 * POST /api/ai/templates
 * 前端「生成」按钮的真实提交入口（契约与页面里展示的 JSON 一致）。
 *
 * Request body:
 *   { domain, templateSlug, interfaceId, model,
 *     params: { prompt, duration, aspect_ratio, resolution, generate_audio, setting, image_urls } }
 *
 * Response:
 *   { ok, jobId, provider, model, state, statusUrl, cost }
 */
const adapter = require('../../server/provider-adapter');
const tokens = require('../../server/tokens');
const { buildPrompt } = require('../../server/prompt');
const auth = require('../../server/auth');
const credits = require('../../server/credits');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: 'POST /api/ai/templates'
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // 必须登录：账号制积分，防匿名刷渲染
  const user = await auth.requireUser(req, res);
  if (!user) return;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'invalid JSON body' });
    }
  }
  const params = (body && body.params) || {};

  // prompt 由服务端组装：客户端只提交 world（city/snow/highway）
  const prompt = (typeof params.prompt === 'string' && params.prompt.trim())
    ? params.prompt
    : buildPrompt({ world: body.world || params.world || 'city' });
  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'could not build prompt' });
  }

  const input = {
    prompt: prompt,
    imageUrls: params.image_urls || [],
    duration: params.duration || 13,
    aspectRatio: params.aspect_ratio || '9:16',
    resolution: params.resolution || '720p',
    audio: params.generate_audio !== false,
    modelKey: params.model === 'bytedance/seedance-v2.5-text-ref' ? 'seedance' : 'auto',
    provider: params.provider || 'auto'
  };

  // 提交前预扣积分（服务端定价为准，前端传什么都不算）
  const cost = credits.creditsForResolution(input.resolution);
  const spent = await credits.spendUser(user.sub, cost, 'render:' + input.resolution);
  if (!spent.ok) {
    return res.status(402).json({ ok: false, error: spent.error, balance: spent.balance, need: spent.need });
  }

  try {
    const job = await adapter.submit(input);
    if (!job.ok) {
      await credits.refundUser(user.sub, cost, 'submit_failed');
      return res.status(502).json({ ok: false, error: job.error, details: job.details, refunded: cost });
    }

    // 记录任务归属，供失败时退款（/api/ai/status）
    await credits.markOrder('job:' + job.provider + ':' + job.providerJobId, {
      userId: user.sub,
      cost: cost,
      resolution: input.resolution,
      refunded: false,
      at: new Date().toISOString()
    });

    const token = tokens.createToken(job.provider + ':' + job.providerJobId);
    const statusUrl =
      '/api/ai/status?provider=' +
      encodeURIComponent(job.provider) +
      '&id=' +
      encodeURIComponent(job.providerJobId) +
      '&token=' +
      token;

    console.log(
      JSON.stringify({
        event: 'job_submitted',
        provider: job.provider,
        model: job.model,
        resolution: input.resolution,
        duration: input.duration,
        userId: user.sub,
        creditsCharged: cost,
        estimatedUsd: job.cost && job.cost.estimatedUsd
      })
    );

    return res.status(202).json({
      ok: true,
      jobId: job.providerJobId,
      provider: job.provider,
      model: job.model,
      state: 'queued',
      statusUrl: statusUrl,
      cost: job.cost,
      creditsCharged: cost,
      balance: spent.balance
    });
  } catch (e) {
    await credits.refundUser(user.sub, cost, 'submit_error');
    console.error(JSON.stringify({ event: 'submit_error', error: e.message }));
    return res.status(500).json({ ok: false, error: e.message, refunded: cost });
  }
};
