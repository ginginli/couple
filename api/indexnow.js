/**
 * IndexNow 推送（Bing / ChatGPT 检索底层）
 *
 * 用途：把 sitemap.xml 里的全部 URL（或指定 URL）推给 IndexNow，让 Bing 尽快收录。
 *
 * 鉴权：header `x-admin-token: <ADMIN_TOKEN>` 或 query ?token=
 * 未配置 ADMIN_TOKEN 时一律 501（避免被当成公开接口刷）。
 *
 * 用法：
 *   curl -X POST https://www.zombie-couple.xyz/api/indexnow \
 *     -H 'x-admin-token: <ADMIN_TOKEN>'
 *
 *   curl -X POST https://www.zombie-couple.xyz/api/indexnow \
 *     -H 'x-admin-token: <ADMIN_TOKEN>' \
 *     -H 'Content-Type: application/json' \
 *     -d '{"urls":["https://www.zombie-couple.xyz/press.html"]}'
 *
 * 前置条件：站点根目录需存在 `<KEY>.txt`（内容与 KEY 一致），供 IndexNow 校验归属。
 */

const SITE = 'zombie-couple.xyz';
const KEY = 'a7f3c9e1b64d8025e4c1f9a3b7d60e28';
const KEY_LOCATION = `https://${SITE}/${KEY}.txt`;
const SITEMAP = `https://${SITE}/sitemap.xml`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function authorized(req) {
  if (!process.env.ADMIN_TOKEN) return false;
  const got = (req.headers && req.headers['x-admin-token']) || (req.query && req.query.token) || '';
  return got === process.env.ADMIN_TOKEN;
}

function locsFromSitemap(xml) {
  const out = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.ADMIN_TOKEN) return res.status(501).json({ ok: false, error: 'admin_disabled' });
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    let urls = Array.isArray(req.body && req.body.urls) ? req.body.urls : null;

    if (!urls) {
      const sm = await fetch(SITEMAP, { headers: { 'user-agent': 'zombie-couple-indexnow/1.0' } });
      if (!sm.ok) return res.status(502).json({ ok: false, error: 'sitemap_unreachable', status: sm.status });
      urls = locsFromSitemap(await sm.text());
    }

    urls = urls.filter((u) => typeof u === 'string' && u.startsWith('https://'));
    if (!urls.length) return res.status(400).json({ ok: false, error: 'no_urls' });

    const payload = { host: SITE, key: KEY, keyLocation: KEY_LOCATION, urlList: urls.slice(0, 10000) };
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    // IndexNow: 200 = 接受，202 = 已接受待处理，其它为错误
    return res.status(200).json({
      ok: r.status === 200 || r.status === 202,
      submitted: payload.urlList.length,
      status: r.status,
      urls: payload.urlList,
    });
  } catch (e) {
    console.error('indexnow_error', e && e.message);
    return res.status(500).json({ ok: false, error: 'indexnow_error' });
  }
};
