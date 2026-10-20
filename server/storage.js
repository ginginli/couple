/**
 * 对象存储适配层
 *
 * blob    → Vercel Blob（推荐：在 Vercel 项目里开通 Blob 后会自动注入 BLOB_READ_WRITE_TOKEN）
 * datauri → 直接把 data URI 回传给模型（仅本地自测用，多数厂商不接受，会提交失败）
 *
 * 选哪个：STORAGE_BACKEND 显式指定；没指定时，有 BLOB_READ_WRITE_TOKEN 就用 blob。
 */

const crypto = require('crypto');

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function backend() {
  return process.env.STORAGE_BACKEND || (process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'datauri');
}

async function put(key, buffer, contentType) {
  const mode = backend();

  if (mode === 'blob') {
    let mod;
    try {
      mod = require('@vercel/blob');
    } catch (e) {
      throw new Error('@vercel/blob not installed — run: npm i @vercel/blob');
    }
    const res = await mod.put(key, buffer, {
      access: 'public',
      contentType: contentType,
      addRandomSuffix: false
    });
    return res.url;
  }

  if (mode === 'datauri') {
    return 'data:' + contentType + ';base64,' + buffer.toString('base64');
  }

  throw new Error('unknown STORAGE_BACKEND: ' + mode);
}

function buildKey(contentType) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = EXT_BY_TYPE[contentType] || 'jpg';
  const prefix = (process.env.UPLOAD_PREFIX || 'uploads').replace(/^\/+|\/+$/g, '');
  return prefix + '/' + y + '/' + m + '/' + crypto.randomUUID() + '.' + ext;
}

module.exports = { put, buildKey, backend, EXT_BY_TYPE };
