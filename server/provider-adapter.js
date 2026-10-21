/**
 * Provider adapter
 * ---------------------------------------------------------------------------
 * 统一入口：submit -> poll -> video_url -> cost
 * 主通道 fal.ai（质量优先），省钱/备份 Atlas Cloud；主通道失败自动切备份。
 *
 * 输入（与前端 POST /api/ai/templates 的 params 对齐）：
 *   {
 *     prompt, imageUrls, duration, aspectRatio, resolution, audio,
 *     refVideoUrl,           // 场景对应的示例短片，场景一致性的来源
 *     keepOriginalSound,     // 有参考视频时：沿用参考视频原声
 *     modelKey: 'kling-o3-r2v' | 'seedance',
 *     provider: 'fal' | 'atlas' | 'auto'
 *   }
 *
 * 输出：
 *   {
 *     provider, providerJobId, model, statusUrl,
 *     state: 'queued'|'running'|'succeeded'|'failed',
 *     videoUrl, cost: { estimatedUsd, ... }
 *   }
 */

const fal = require('./providers/fal');
const atlas = require('./providers/atlascloud');

const PROVIDERS = { fal: fal, atlas: atlas };

/**
 * 单一 provider，不做降级：
 * 降级通道会静默改变成片（例：只收一张图 → 第二个人不出现），宁可报错也不给错结果。
 * 用 VIDEO_PROVIDER 显式指定（fal / atlas）；没指定时按“配了哪个 key 就用哪个”。
 */
const PROVIDER = process.env.VIDEO_PROVIDER || (process.env.ATLAS_KEY ? 'atlas' : 'fal');

function resolveProvider(preferred) {
  if (preferred && preferred !== 'auto') return preferred;
  return PROVIDER;
}

function normalizeInput(input) {
  const duration = Number(input.duration) || 13;
  return {
    prompt: input.prompt || '',
    imageUrls: Array.isArray(input.imageUrls) ? input.imageUrls.slice(0, 7) : [],
    // 参考视频与音频策略必须透传：漏了它们，成片的场景就和示例短片对不上
    refVideoUrl: input.refVideoUrl || null,
    keepOriginalSound: input.keepOriginalSound !== false,
    duration: duration,
    aspectRatio: input.aspectRatio || '9:16',
    resolution: input.resolution || '720p',
    audio: input.audio !== false,
    modelKey: input.modelKey || 'kling-o3-r2v'
  };
}

/**
 * 挑模型：Atlas 由 provider 内部按档位选（Kling Std/Pro），fal 侧 480p 走便宜的 Seedance
 */
function pickModelKey(input, providerName) {
  if (input.modelKey && input.modelKey !== 'auto') return input.modelKey;
  if (providerName === 'atlas') return 'kling-o3-r2v';
  return input.resolution === '480p' ? 'seedance' : 'kling-o3-r2v';
}

async function submit(input) {
  const norm = normalizeInput(input);
  // 顺序不能反：name 必须先声明。写在 modelKey 之后会触发 TDZ
  // （"Cannot access 'name' before initialization"），真实提交全部失败
  const name = resolveProvider(norm.provider);
  norm.modelKey = pickModelKey(norm, name);
  const provider = PROVIDERS[name];

  if (!provider) return { ok: false, error: 'unknown_provider', provider: name };

  try {
    const ref = await provider.submit(norm);
    return {
      ok: true,
      provider: name,
      providerJobId: ref.providerJobId,
      model: ref.model,
      modelKey: norm.modelKey,
      statusUrl: ref.statusUrl,
      state: 'queued',
      videoUrl: null,
      cost: provider.estimateCost(norm, null)
    };
  } catch (e) {
    // 必须带上 body：只记 e.message 的话线上看到的只是 "HTTP 400 from ..."，根本查不出原因
    console.error(JSON.stringify({
      event: 'provider_submit_failed', provider: name,
      error: e.message, status: e.status || null, body: (e.body || '').toString().slice(0, 800)
    }));
    return { ok: false, error: e.message, status: e.status || null, provider: name, body: e.body || null };
  }
}

async function poll(ref) {
  const provider = PROVIDERS[ref.provider];
  if (!provider) throw new Error('unknown provider: ' + ref.provider);

  let st = await provider.status(ref);

  // Atlas 会在 status 里直接带结果；fal 需要再取一次 result
  if (st.state === 'succeeded' && !st.videoUrl && provider.result) {
    try {
      const res = await provider.result(ref);
      st.videoUrl = res.videoUrl || null;
      st.raw = res.raw || st.raw;
    } catch (e) {
      console.error(JSON.stringify({ event: 'provider_result_failed', provider: ref.provider, error: e.message }));
    }
  }

  return {
    provider: ref.provider,
    providerJobId: ref.providerJobId,
    state: st.state,
    videoUrl: st.videoUrl || null,
    raw: st.raw
  };
}

module.exports = {
  PROVIDERS,
  PROVIDER,
  DEFAULT_CHAIN: [PROVIDER],
  normalizeInput,
  pickModelKey,
  submit,
  poll
};
