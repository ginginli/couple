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
  'kling-o3-r2v': process.env.ATLAS_MODEL_KLING_R2V || 'kwaivgi/kling-video-o3-std/reference-to-video', // 720P 固定
  'kling-o3-pro': process.env.ATLAS_MODEL_KLING_PRO || 'kwaivgi/kling-video-o3-pro/reference-to-video', // 1080P 固定
  seedance: process.env.ATLAS_MODEL_SEEDANCE || 'bytedance/seedance-v2.5-text-ref',
  grok: process.env.ATLAS_MODEL_GROK || 'xai/grok-imagine-video/reference-to-video'                     // 真 480p/720p，但 ≤10s 且无音频
};

/**
 * 站点档位 → 模型。
 * Atlas 上 Kling O3 的输出分辨率是写死的（Std=720P / Pro=1080P），接口没有 resolution 参数，
 * 所以「不同档位不同画质」只能靠换模型实现。可用环境变量逐档覆盖。
 */
const RES_MODEL = {
  '480p': process.env.ATLAS_MODEL_480P || MODELS['kling-o3-r2v'],
  '720p': process.env.ATLAS_MODEL_720P || MODELS['kling-o3-r2v'],
  '1080p': process.env.ATLAS_MODEL_1080P || MODELS['kling-o3-pro']
};

// USD / second —— 列表价，同样需要实测校准
const RATES = {
  // 480p/720p 走的是同一个模型（Std 固定 720P），真实成本相同，别按档位给不同单价
  // 实测：13 秒 720p，Atlas 返回 price=1.2376 → 1.2376/13 ≈ $0.0952/秒（2026-10-21）
  'kling-o3-r2v': { '480p': 0.0952, '720p': 0.0952, '1080p': 0.0952 },
  // Pro 未实测，按 Std 的 2 倍估（待跑一次 1080p 校准）
  'kling-o3-pro': { '480p': 0.19, '720p': 0.19, '1080p': 0.19 },
  grok: { '480p': 0.05, '720p': 0.05, '1080p': 0.05 },
  seedance: { '480p': 0.06, '720p': 0.134, '1080p': 0.25 }
};

const id = 'atlas';

function headers() {
  let key = process.env.ATLAS_KEY;
  if (!key) throw new Error('ATLAS_KEY is not set');
  // 复制粘贴常带换行/空格；HTTP header 只接受可打印 ASCII，非 ASCII 会抛
  // "Cannot convert argument to a ByteString"（极难排查），这里提前拦住并报清楚
  key = String(key).replace(/\s+/g, '');
  const bad = key.match(/[^\x20-\x7E]/g);
  if (bad) {
    throw new Error(
      'ATLAS_KEY contains non-ASCII characters: ' + JSON.stringify(bad.slice(0, 5).join('')) +
      ' (位置约第 ' + key.indexOf(bad[0]) + ' 位) —— 请重新复制，不要带上中文/全角字符'
    );
  }
  return { Authorization: 'Bearer ' + key };
}

function pickModel(modelKey) {
  return MODELS[modelKey] || MODELS['kling-o3-r2v'];
}

function clampDuration(d, max) {
  const n = Number(d) || 13;
  return Math.max(3, Math.min(max || 15, Math.round(n)));
}

/** Atlas(Kling) 用 <<<image_1>>> / <<<image_2>>> / <<<video_1>>> 指代输入，fal 用 @Image1 / @Image2 */
function toAtlasPrompt(prompt) {
  return String(prompt || '')
    .replace(/@Image1/g, '<<<image_1>>>')
    .replace(/@Image2/g, '<<<image_2>>>')
    .replace(/@Video1/g, '<<<video_1>>>');
}

/** Grok Imagine 用 <IMAGE_1> / <IMAGE_2> */
function toGrokPrompt(prompt) {
  return String(prompt || '')
    .replace(/@Image1/g, '<IMAGE_1>')
    .replace(/@Image2/g, '<IMAGE_2>');
}

function familyOf(model) {
  return /grok/i.test(model) ? 'grok' : 'kling';
}

/** 按档位选模型（可用 ATLAS_MODEL_480P / _720P / _1080P 覆盖） */
function pickModelForResolution(res) {
  return RES_MODEL[res] || MODELS['kling-o3-r2v'];
}

function buildRequest(input) {
  const modelKey = input.modelKey || 'kling-o3-r2v';
  const images = (input.imageUrls || []).filter(Boolean).slice(0, 7);
  const model = pickModelForResolution(input.resolution);
  const family = familyOf(model);
  const ar = input.aspectRatio || '9:16';
  // 参考视频：按场景对应的示例短片，锁住场景/光线/运镜（Kling 的 video 字段）
  const refVideo = input.refVideoUrl || null;

  let body;
  if (family === 'grok') {
    // Grok：字段名与 Kling 不同（image_urls / resolution），最长 10 秒，不生成音频
    body = {
      model: model,
      prompt: toGrokPrompt(input.prompt),
      image_urls: images,
      duration: clampDuration(input.duration, 10),
      resolution: input.resolution === '480p' ? '480p' : '720p',
      aspect_ratio: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'].indexOf(ar) !== -1 ? ar : '9:16'
    };
  } else {
    // Atlas 硬限制 prompt ≤ 2500 字符，超出直接 ret:1201 失败（积分白扣）
    let prompt = toAtlasPrompt(input.prompt);
    if (prompt.length > 2500) {
      console.warn(JSON.stringify({ event: 'prompt_truncated', provider: id, from: prompt.length, to: 2500 }));
      prompt = prompt.slice(0, 2500);
    }
    body = {
      model: model,
      prompt: prompt,
      // 传了参考视频时，Atlas 把参考图上限从 7 张降到 4 张（我们只用 2 张，始终安全）
      images: images.slice(0, refVideo ? 4 : 7),
      duration: clampDuration(input.duration, 15),
      aspect_ratio: ['16:9', '9:16', '1:1'].indexOf(ar) !== -1 ? ar : '9:16',
      // 有参考视频时 multi_shot 只允许 intelligence（我们本来就是）
      multi_shot: true,
      shot_type: 'intelligence'             // 由模型按 prompt 自动分镜（我们的 prompt 已写好四镜）
    };
    if (refVideo) {
      // 只要传了 video，Atlas 会强制关闭 sound（原生音频生成），
      // 音频改由 keep_original_sound 决定：true = 沿用参考视频原声
      body.video = refVideo;
      body.keep_original_sound = input.keepOriginalSound !== false;
      body.sound = false;
    } else {
      body.sound = input.audio !== false;   // Atlas 的音频字段是 sound，不是 enable_audio
    }
  }
  return { url: BASE + SUBMIT_PATH, headers: headers(), body: body, model: model, modelKey: modelKey };
}

function logSubmit(req) {
  console.log(JSON.stringify({
    event: 'provider_submit_request', provider: id, model: req.body.model,
    promptHead: String(req.body.prompt || '').slice(0, 160),
    promptLen: String(req.body.prompt || '').length,
    images: (req.body.images || req.body.image_urls || []).slice(0, 2),
    video: req.body.video || null,
    hasVideo: !!req.body.video,      // 传了参考视频 → 计价可能不同，出片后拿 price 对照
    keep_original_sound: req.body.keep_original_sound,
    sound: req.body.sound,
    duration: req.body.duration, aspect_ratio: req.body.aspect_ratio,
    multi_shot: req.body.multi_shot
  }));
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
  // Atlas states: queued -> processing -> completed/failed
  let state = 'running';
  if (data.status === 'completed') state = 'succeeded';
  else if (data.status === 'failed' || data.error) state = 'failed';
  else if (normalizeState(data.status) === 'queued') state = 'queued';
  
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
  const model = pickModelForResolution(input.resolution);
  const key = familyOf(model) === 'grok' ? 'grok' : (/o3-pro/.test(model) ? 'kling-o3-pro' : 'kling-o3-r2v');
  const rates = RATES[key] || RATES['kling-o3-r2v'];
  const perSec = rates[input.resolution] || rates['720p'];
  const seconds = clampDuration(input.duration);
  
  // Try to get actual price from Atlas response
  const data = result && result.raw && result.raw.data;
  const reportedUsd = data && data.price ? parseFloat(data.price) : null;
  
  return {
    provider: id,
    modelKey: input.modelKey,
    resolution: input.resolution,
    model: model,
    // Kling O3 Std 固定 720P / Pro 固定 1080P（接口无 resolution 参数）；Grok 才真的按参数出
    deliveredResolution: familyOf(model) === 'grok'
      ? (input.resolution === '480p' ? '480p' : '720p')
      : (/o3-pro/.test(model) ? '1080p' : '720p'),
    seconds: seconds,
    ratePerSecond: perSec,
    estimatedUsd: Number((perSec * seconds).toFixed(4)),
    reportedUsd: reportedUsd
  };
}

async function submit(input) {
  const req = buildRequest(input);
  // 提交前留痕：出片跑偏时能立刻对照「当时发出去的到底是什么」
  logSubmit(req);
  let json;
  try {
    json = await http.post(req.url, req.headers, req.body, 30000, 1);
  } catch (e) {
    // 参考视频是场景一致性的唯一来源。Atlas 一旦拒收（例如短片尺寸不合
    // 700-4553px 的要求），直接让整单失败，绝不退回「不带参考视频继续生成」：
    // 那样产出的成片和示例必然不是一个世界，等于白扣用户积分。
    // 上层 /api/ai/templates 收到失败会把预扣的积分原路退回。
    if (req.body.video) {
      console.error(JSON.stringify({
        event: 'ref_video_rejected', provider: id, model: req.body.model,
        video: req.body.video, status: e.status || null,
        body: String(e.body || '').slice(0, 300)
      }));
      const err = new Error(
        'reference video rejected by Atlas (HTTP ' + (e.status || '?') + '): ' + req.body.video
      );
      err.status = e.status;
      err.body = e.body;
      throw err;
    }
    throw e;
  }
  const ref = parseSubmit(json, req);
  return Object.assign(ref, {
    provider: id, model: req.body.model, modelKey: req.modelKey,
    usedRefVideo: !!req.body.video
  });
}

// 轮询入口只拿得到 jobId（/api/ai/status 与补偿扫描都不持有提交时的完整 ref），
// 这里必须能从 jobId 还原状态地址，否则 fetch(undefined) 会让每次轮询都失败
function statusUrlOf(ref) {
  return ref.statusUrl || (BASE + STATUS_PATH + '/' + ref.providerJobId);
}

async function status(ref) {
  const json = await http.get(statusUrlOf(ref), headers(), 15000, 1);
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
  const json = await http.get(ref.resultUrl || statusUrlOf(ref), headers(), 20000, 1);
  return parseResult(json);
}

module.exports = {
  id,
  MODELS,
  RES_MODEL,
  RATES,
  pickModelForResolution,
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
