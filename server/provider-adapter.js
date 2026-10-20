/**
 * Provider adapter
 * ---------------------------------------------------------------------------
 * 统一入口：submit -> poll -> video_url -> cost
 * 主通道 fal.ai（质量优先），省钱/备份 Atlas Cloud；主通道失败自动切备份。
 *
 * 输入（与前端 POST /api/ai/templates 的 params 对齐）：
 *   {
 *     prompt, imageUrls, duration, aspectRatio, resolution, audio,
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

const DEFAULT_CHAIN = (process.env.VIDEO_PROVIDER_CHAIN || 'fal,atlas')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function resolveChain(preferred) {
  if (preferred && preferred !== 'auto' && PROVIDERS[preferred]) {
    const rest = DEFAULT_CHAIN.filter((p) => p !== preferred);
    return [preferred].concat(rest);
  }
  return DEFAULT_CHAIN.slice();
}

function normalizeInput(input) {
  const duration = Number(input.duration) || 13;
  return {
    prompt: input.prompt || '',
    imageUrls: Array.isArray(input.imageUrls) ? input.imageUrls.slice(0, 7) : [],
    duration: duration,
    aspectRatio: input.aspectRatio || '9:16',
    resolution: input.resolution || '720p',
    audio: input.audio !== false,
    modelKey: input.modelKey || 'kling-o3-r2v'
  };
}

/** 按分辨率挑模型：480p 走 Seedance（便宜），720p/1080p 走 Kling O3（多参考图 + 身份一致） */
function pickModelKey(input) {
  if (input.modelKey && input.modelKey !== 'auto') return input.modelKey;
  return input.resolution === '480p' ? 'seedance' : 'kling-o3-r2v';
}

async function submit(input) {
  const norm = normalizeInput(input);
  norm.modelKey = pickModelKey(norm);
  const chain = resolveChain(norm.provider);
  const errors = [];

  for (let i = 0; i < chain.length; i++) {
    const name = chain[i];
    const provider = PROVIDERS[name];
    if (!provider) continue;
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
        cost: provider.estimateCost(norm, null),
        attempts: chain.slice(0, i + 1)
      };
    } catch (e) {
      errors.push({ provider: name, message: e.message, body: e.body || null });
      console.error(
        JSON.stringify({ event: 'provider_submit_failed', provider: name, error: e.message })
      );
    }
  }

  return { ok: false, error: 'all providers failed', details: errors };
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
  DEFAULT_CHAIN,
  normalizeInput,
  pickModelKey,
  submit,
  poll
};
