/**
 * Atlas Cloud provider adapter (cheap channel / fallback)
 *
 * API 文档: https://www.atlascloud.ai/docs
 * 端点: https://api.atlascloud.ai/api/v1
 * 
 * 可用环境变量覆盖：
 *   ATLAS_BASE         默认 https://api.atlascloud.ai/api/v1
 *   ATLAS_SUBMIT_PATH  默认 /model/generateVideo
 *   ATLAS_STATUS_PATH  默认 /model/prediction
 */

const http = require('../http');

const BASE = process.env.ATLAS_BASE || 'https://api.atlascloud.ai/api/v1';
const SUBMIT_PATH = process.env.ATLAS_SUBMIT_PATH || '/model/generateVideo';
const STATUS_PATH = process.env.ATLAS_STATUS_PATH || '/model/prediction';

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

/** Atlas 用 <<<image_1>>> / <<<image_2>>> 指代参考图，fal 用 @Image1 / @Image2 */
function toAtlasPrompt(prompt) {
  return String(prompt || '')
    .replace(/@Image1/g, '<<<image_1>>>')
    .replace(/@Image2/g, '<<<image_2>>>');
}

function buildRequest(input) {
  const modelKey = input.modelKey || 'kling-o3-r2v';
  const images = (input.imageUrls || []).filter(Boolean).slice(0, 7);
  const body = {
    model: pickModel(modelKey),
    prompt: toAtlasPrompt(input.prompt),
    images: images,                       // 参考图数组（无参考视频时最多 7 张）
    duration: clampDuration(input.duration),
    aspect_ratio: ['16:9', '9:16', '1:1'].indexOf(input.aspectRatio) !== -1 ? input.aspectRatio : '9:16',
    sound: input.audio !== false,         // Atlas 的音频字段是 sound，不是 enable_audio
    multi_shot: true,
    shot_type: 'intelligence'             // 由模型按 prompt 自动分镜（我们的 prompt 已写好四镜）
  };
  return { url: BASE + SUBMIT_PATH, headers: headers(), body: body, model: body.model, modelKey: modelKey };
}

function parseSubmit(json, ctx) {
  // Atlas wraps response in {"code":200,"message":"","data":{...}}
  const data = json.data || json;
  const jobId = data.id;
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
  const data = json.data || json;
  // Atlas states: processing, completed, failed
  let state = 'running';
  if (data.status === 'completed') state = 'succeeded';
  else if (data.status === 'failed' || data.error) state = 'failed';
  else if (data.status === 'processing' || data.status === 'queued') state = 'queued';
  
  return { state, raw: json };
}

function parseResult(json) {
  const data = json.data || json;
  // Atlas returns video URL in outputs array or urls.get
  let videoUrl = null;
  
  // Check outputs array (Atlas format)
  if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
    videoUrl = data.outputs.find(o => typeof o === 'string' && o.endsWith('.mp4')) || data.outputs[0];
  }
  
  // Check urls.get
  if (!videoUrl && data.urls && data.urls.get) {
    // Need to fetch from status URL again for actual video
    videoUrl = null;
  }
  
  return { videoUrl, raw: json };
}

function estimateCost(input, result) {
  const rates = RATES[input.modelKey] || RATES['kling-o3-r2v'];
  const perSec = rates[input.resolution] || rates['720p'];
  const seconds = clampDuration(input.duration);
  
  // Try to get actual price from Atlas response
  const data = result && result.raw && result.raw.data;
  const reportedUsd = data && data.price ? parseFloat(data.price) : null;
  
  return {
    provider: id,
    modelKey: input.modelKey,
    resolution: input.resolution,
    // 注意：Atlas 的 Kling O3 Standard 输出固定 720P，接口不接受 resolution 字段，
    // 因此站点卖的 480p/1080p 档在 Atlas 上不会改变实际画质
    deliveredResolution: '720p',
    seconds: seconds,
    ratePerSecond: perSec,
    estimatedUsd: Number((perSec * seconds).toFixed(4)),
    reportedUsd: reportedUsd
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
  
  // If completed, extract video URL from same response
  if (parsed.state === 'succeeded') {
    const data = json.data || json;
    if (data.outputs && Array.isArray(data.outputs)) {
      parsed.videoUrl = data.outputs.find(o => typeof o === 'string' && o.endsWith('.mp4')) || data.outputs[0];
    }
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
