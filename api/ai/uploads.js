/**
 * POST /api/ai/uploads
 * 把前端上传的照片换成公网可访问的 URL，供 Kling O3 / Seedance 的 image_urls 使用。
 *
 * Request:  { images: ["data:image/jpeg;base64,...", ... ] }   （最多 2 张）
 * Response: { ok: true, urls: ["https://.../uploads/2026/10/xxx.jpg", ...] }
 *
 * 限制说明：
 * - Vercel Serverless 请求体上限 4.5MB。前端已用 canvas 压缩（长边 1280 / JPEG 0.82），
 *   单张通常在 100–400KB，两张一起远低于上限。
 * - 只接受 JPEG / PNG / WebP，用文件头字节校验，不信任客户端声明的 MIME。
 * - 单张解码后上限 6MB，防止超大原图打爆内存。
 */
const storage = require('../../server/storage');

const MAX_IMAGES = 2;
const MAX_BYTES = 6 * 1024 * 1024;

const SIGNATURES = [
  { type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: 'image/png',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  },
  {
    type: 'image/webp',
    test: (b) =>
      b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
  }
];

function detectType(buffer) {
  for (const sig of SIGNATURES) {
    if (sig.test(buffer)) return sig.type;
  }
  return null;
}

function decodeImage(value) {
  if (typeof value !== 'string') throw new Error('image must be a string');
  const m = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+)?;base64,(.*)$/s.exec(value);
  const base64 = m ? m[2] : value; // 也允许直接传裸 base64
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new Error('empty image');
  if (buffer.length > MAX_BYTES) {
    throw new Error('image too large: ' + buffer.length + ' bytes (max ' + MAX_BYTES + ')');
  }
  const type = detectType(buffer);
  if (!type) throw new Error('unsupported image type (jpeg / png / webp only)');
  return { buffer: buffer, contentType: type };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: 'POST /api/ai/uploads',
      maxImages: MAX_IMAGES,
      maxBytes: MAX_BYTES,
      backend: storage.backend()
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'invalid JSON body' });
    }
  }

  const images = body && body.images;
  if (!Array.isArray(images) || !images.length) {
    return res.status(400).json({ ok: false, error: 'images[] is required' });
  }
  if (images.length > MAX_IMAGES) {
    return res.status(400).json({ ok: false, error: 'at most ' + MAX_IMAGES + ' images' });
  }

  try {
    const urls = [];
    for (const item of images) {
      const { buffer, contentType } = decodeImage(item);
      const key = storage.buildKey(contentType);
      const url = await storage.put(key, buffer, contentType);
      urls.push(url);
    }
    console.log(JSON.stringify({ event: 'upload_ok', count: urls.length, backend: storage.backend() }));
    return res.status(200).json({ ok: true, urls: urls });
  } catch (e) {
    console.error(JSON.stringify({ event: 'upload_failed', error: e.message }));
    return res.status(400).json({ ok: false, error: e.message });
  }
};
