/**
 * fal.ai provider adapter (primary channel)
 *
 * Submit:  POST https://queue.fal.run/{model}          -> { request_id, status_url, response_url }
 * Status:  GET  {status_url}                            -> { status: IN_QUEUE|IN_PROGRESS|COMPLETED|FAILED }
 * Result:  GET  {response_url}                          -> { video: { url, ... } }
 *
 * NOTE: 模型 id 与部分参数名请在 fal 控制台/目录页核对后通过环境变量覆盖：
 *   FAL_MODEL_KLING_R2V  默认 fal-ai/kling-video/o3/standard/reference-to-video
 *   FAL_MODEL_SEEDANCE   默认 bytedance/seedance-v2.5-text-ref（如目录 id 不同请覆盖）
 */

const http = require('../http');

const BASE = 'https://queue.fal.run';

const MODELS = {
  'kling-o3-r2v': process.env.FAL_MODEL_KLING_R2V || 'fal-ai/kling-video/o3/standard/reference-to-video',
  seedance: process.env.FAL_MODEL_SEEDANCE || 'bytedance/seedance-v2.5-text-ref'
};

// USD / second —— 列表价，务必用实测扣费校准（见 scripts/provider-selftest.js）
const RATES = {
  'kling-o3-r2v': { '480p': 0.05, '720p': 0.085, '1080p': 0.15 },
  seedance: { '480p': 0.1, '720p': 0.3034, '1080p': 0.45 }
};

const id = 'fal';

function headers() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not set');
  return { Authorization: 'Key ' + key };
}

function pickModel(modelKey) {
  return MODELS[modelKey] || MODELS['kling-o3-r2v'];
}

function clampDuration(d) {
  const n = Number(d) || 13;
  return Math.max(3, Math.min(15, Math.round(n)));
}

function buildRequest(input) {
  const modelKey = input.modelKey || 'kling-o3-r2v';
  const model = pickModel(modelKey);
  const body = {
    prompt: input.prompt,
    image_urls: input.imageUrls || [],
    duration: clampDuration(input.duration),
    aspect_ratio: input.aspectRatio || '9:16',
    generate_audio: input.audio !== false
  };
  if (modelKey === 'kling-o3-r2v') {
    // 四镜头叙事：单次生成里切镜
    body.multi_shot = true;
  }
  return { url: BASE + '/' + model, headers: headers(), body: body, model: model, modelKey: modelKey };
}

function parseSubmit(json, ctx) {
  const requestId = json.request_id || json.requestId || json.id;
  if (!requestId) {
    throw new Error('fal submit did not return request_id: ' + JSON.stringify(json).slice(0, 300));
  }
  return {
    providerJobId: requestId,
    statusUrl: json.status_url || BASE + '/' + ctx.model + '/' + requestId + '/status',
    resultUrl: json.response_url || BASE + '/' + ctx.model + '/' + requestId,
    raw: json
  };
}

function buildStatus(ref) {
  return { url: ref.statusUrl, headers: headers() };
}

function buildResult(ref) {
  return { url: ref.resultUrl, headers: headers() };
}

function normalizeState(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'COMPLETED' || v === 'SUCCEEDED' || v === 'SUCCESS') return 'succeeded';
  if (v === 'FAILED' || v === 'ERROR' || v === 'CANCELLED') return 'failed';
  if (v === 'IN_QUEUE' || v === 'QUEUED' || v === 'PENDING') return 'queued';
  return 'running';
}

function parseStatus(json) {
  return { state: normalizeState(json.status), raw: json };
}

function parseResult(json) {
  const url =
    (json.video && (json.video.url || json.video.uri)) ||
    json.video_url ||
    (json.output && (json.output.video_url || json.output.url)) ||
    (json.data && json.data.video_url) ||
    null;
  return { videoUrl: url, raw: json };
}

function estimateCost(input, result) {
  const rates = RATES[input.modelKey] || RATES['kling-o3-r2v'];
  const perSec = rates[input.resolution] || rates['720p'];
  const seconds = clampDuration(input.duration);
  const reported =
    result && result.raw && (result.raw.cost || (result.raw.usage && result.raw.usage.cost));
  return {
    provider: id,
    modelKey: input.modelKey,
    resolution: input.resolution,
    seconds: seconds,
    ratePerSecond: perSec,
    estimatedUsd: Number((perSec * seconds).toFixed(4)),
    reportedUsd: typeof reported === 'number' ? reported : null
  };
}

async function submit(input) {
  const req = buildRequest(input);
  const json = await http.post(req.url, req.headers, req.body, 30000, 1);
  const ref = parseSubmit(json, req);
  return Object.assign(ref, { provider: id, model: req.model, modelKey: req.modelKey });
}

async function status(ref) {
  const s = buildStatus(ref);
  const json = await http.get(s.url, s.headers, 15000, 1);
  return parseStatus(json);
}

async function result(ref) {
  const r = buildResult(ref);
  const json = await http.get(r.url, r.headers, 20000, 1);
  return parseResult(json);
}

module.exports = {
  id,
  MODELS,
  RATES,
  submit,
  status,
  result,
  estimateCost,
  normalizeState,
  buildRequest,
  parseSubmit,
  parseStatus,
  parseResult
};
