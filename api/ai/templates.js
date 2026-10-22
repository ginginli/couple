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
const { buildPrompt, refVideoFor } = require('../../server/prompt');
const auth = require('../../server/auth');
const credits = require('../../server/credits');
const reconcile = require('../../server/reconcile');

// 作品卡展示用的角色名来自前端（文件名/自定义名），落库前统一裁剪并去掉尖括号
function cleanLabel(value, fallback) {
  const s = typeof value === 'string' ? value.replace(/[<>]/g, '').trim() : '';
  return (s || fallback).slice(0, 60);
}

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
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'invalid JSON body' });
  }
  const params = (body && body.params) || {};

  // prompt 与参考视频都由服务端按场景决定：客户端只提交 world（city/highway）
  const world = body.world || params.world || 'city';
  const prompt = (typeof params.prompt === 'string' && params.prompt.trim())
    ? params.prompt
    : buildPrompt({ world: world });
  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'could not build prompt' });
  }

  // 必须两张真实上传的图片：少一张直接 400，不扣积分、不请求 provider
  var imageUrls = (params.image_urls || []).filter(function (u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u.trim());
  });
  if (imageUrls.length < 2) {
    return res.status(400).json({
      ok: false,
      error: 'two_uploaded_images_required',
      hint: '需要先上传两张照片（公网可访问 URL）才能生成'
    });
  }

  // 只开放 720p / 1080p 两档
  const resolution = params.resolution || '720p';
  if (!credits.isTier(resolution)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_resolution',
      allowed: credits.TIERS,
      hint: '只提供 720p / 1080p 两档'
    });
  }

  const input = {
    prompt: prompt,
    imageUrls: imageUrls.slice(0, 2),
    // 场景对应的示例短片：锁住场景、光线与运镜，保证成片和示例是同一个世界
    refVideoUrl: refVideoFor(world),
    // 传了参考视频后 Atlas 会关闭原生音频生成，音频由它决定：true=沿用参考视频原声
    keepOriginalSound: true,
    duration: params.duration || 13,
    aspectRatio: params.aspect_ratio || '9:16',
    resolution: resolution,
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
      console.error(JSON.stringify({
        event: 'submit_failed', provider: job.provider, error: job.error,
        status: job.status || null, body: (job.body || '').toString().slice(0, 800)
      }));
      return res.status(502).json({
        ok: false, error: job.error, provider: job.provider,
        providerStatus: job.status || null,
        providerBody: (job.body || '').toString().slice(0, 800),
        refunded: cost
      });
    }

    // 记录任务归属，供失败时退款（/api/ai/status）与成功后落作品库
    const orderKey = 'job:' + job.provider + ':' + job.providerJobId;
    await credits.markOrder(orderKey, {
      userId: user.sub,
      cost: cost,
      resolution: input.resolution,
      world: world,
      role1: cleanLabel(body && body.role1, 'Image 1'),
      role2: cleanLabel(body && body.role2, 'Image 2'),
      lang: (body && body.lang) === 'zh' ? 'zh' : 'en',
      model: job.model,
      provider: job.provider,
      refunded: false,
      at: new Date().toISOString()
    });
    // 登记到补偿扫描：用户关掉页面、没人轮询时，也能落作品库 / 失败退款
    try {
      await reconcile.track(user.sub, orderKey);
    } catch (e) {
      console.error(JSON.stringify({ event: 'reconcile_track_failed', jobId: job.providerJobId, error: e.message }));
    }

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
