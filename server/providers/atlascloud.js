/**
 * Atlas Cloud provider adapter (cheap channel / fallback)
 *
 * OpenAI 兼容网关：一个 Key 调图像、视频、语音。
 * 提交与查询路径各版本可能不同，可用环境变量覆盖：
 *   ATLAS_BASE         默认 https://api.atlascloud.ai/v1
 *   ATLAS_SUBMIT_PATH  默认 /video/generations
 *   ATLAS_STATUS_PATH  默认 /generations      (最终 GET {base}{statusPath}/{id})
 *
 * 先跑 `npm run selftest -- --provider atlas` 打印原始响应，再按真实返回校准 parse* 方法。
 */

const http = require('../http');

const BASE = process.env.ATLAS_BASE || 'https://api.atlascloud.ai/v1';
const SUBMIT_PATH = process.env.ATLAS_SUBMIT_PATH || '/video/generations';
const STATUS_PATH = process.env.ATLAS_STATUS_PATH || '/generations';

const MODELS = {
  'kling-o3-r2v': process.env.ATLAS_MODEL_KLING_R2V || 'kwaivgi/kling-video-o3-std/reference-to-video',
  seedance: process.env.ATLAS_MODEL_SEEDANCE || 'bytedance/seedance-v2.5-text-ref'
};

// USD / second —— 列表价，同样需要实测校准
const RATES = {
  'kling-o3-r2v': { '480p': 0.04, '720p': 0.07, '1080p': 0.12 },
  seedance: { '480p': 0.06, '720p': 0.134, '1080p': 0.25 }
};

const id = 'atlas';

function headers() {
  const key = process.env.ATLAS_KEY;
  if (!key) throw new Error('ATLAS_KEY is not set');
  return { Authorization: 'Bearer ' + key };
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
  const body = {
    model: pickModel(modelKey),
    prompt: input.prompt,
    images: input.imageUrls || [],
    duration: clampDuration(input.duration),
    aspect_ratio: input.aspectRatio || '9:16',
    generate_audio: input.audio !== false
  };
  if (modelKey === 'kling-o3-r2v') body.multi_shot = true;
  return { url: BASE + SUBMIT_PATH, headers: headers(), body: body, modelKey: modelKey };
}

function parseSubmit(json, ctx) {
  const job = json.data || json;
  const jobId = job.id || job.job_id || job.request_id || job.task_id;
  if (!jobId) {
    throw new Error('atlas submit did not return an id: ' + JSON.stringify(json).slice(0, 300));
  }
  return {
    providerJobId: jobId,
    statusUrl: BASE + STATUS_PATH + '/' + jobId,
    resultUrl: BASE + STATUS_PATH + '/' + jobId,
    raw: json,
    modelKey: ctx.modelKey
  };
}

function normalizeState(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'succeeded' || v === 'success' || v === 'completed' || v === 'done') return 'succeeded';
  if (v === 'failed' || v === 'error' || v === 'cancelled' || v === 'canceled') return 'failed';
  if (v === 'queued' || v === 'pending' || v === 'waiting' || v === 'in_queue') return 'queued';
  return 'running';
}

function parseStatus(json) {
  const job = json.data || json;
  return { state: normalizeState(job.status || job.state), raw: json };
}

function parseResult(json) {
  const job = json.data || json;
  const out = job.output || job.result || job;
  const url =
    out.video_url ||
    out.video ||
    (out.videos && out.videos[0] && (out.videos[0].url || out.videos[0].video_url)) ||
    (job.video && job.video.url) ||
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
  return Object.assign(ref, { provider: id, model: req.body.model, modelKey: req.modelKey });
}

async function status(ref) {
  const json = await http.get(ref.statusUrl, headers(), 15000, 1);
  const parsed = parseStatus(json);
  if (parsed.state === 'succeeded' && !parsed.videoUrl) {
    // Atlas 多数直接在同一响应里返回结果
    const res = parseResult(json);
    parsed.videoUrl = res.videoUrl;
  }
  return parsed;
}

async function result(ref) {
  const json = await http.get(ref.resultUrl, headers(), 20000, 1);
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
