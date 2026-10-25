/**
 * 后台接口统一入口（需 ADMIN_TOKEN，未配置时回退 CRON_SECRET）
 *
 * Vercel Hobby 每个部署最多 12 个 Serverless Function，因此把后台/运维接口合并到单个函数。
 *
 *   GET  /api/admin?action=list                 列出待认领的付款邮箱
 *   POST /api/admin?action=grant   { email|sub, credits, note }   补发积分
 *   POST /api/admin?action=refund  { email|sub, credits, orderId } 人工收回积分
 *   GET  /api/admin?action=repair[&jobId=xxx][&provider=atlas]    强制复查卡住的任务 / 扫描全部未终态订单
 *   POST /api/admin?action=indexnow [ { urls: [...] } ]           推送到 IndexNow
 *
 * 鉴权：header `x-admin-token: <secret>` 或 query ?token=
 */
const auth = require('../server/auth');
const credits = require('../server/credits');
const billing = require('../server/billing');
const reconcile = require('../server/reconcile');
const adapter = require('../server/provider-adapter');

const INDEXNOW_SITE = 'zombie-couple.xyz';
const INDEXNOW_KEY = 'a7f3c9e1b64d8025e4c1f9a3b7d60e28';
const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_SITE}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_SITEMAP = `https://${INDEXNOW_SITE}/sitemap.xml`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

function adminSecret() {
  return process.env.ADMIN_TOKEN || process.env.CRON_SECRET || '';
}

function authorized(req) {
  const secret = adminSecret();
  if (!secret) return false;
  const got = (req.headers && req.headers['x-admin-token'])
    || (req.headers && req.headers['x-cron-secret'])
    || (req.query && req.query.token)
    || '';
  return String(got) === secret;
}

function actionOf(req, body) {
  const raw = (req.query && req.query.action) || body.action || (req.method === 'GET' ? 'list' : 'grant');
  return String(raw).trim();
}

async function handleGrant(req, res, body) {
  if (body.action === 'refund') {
    const amt = Number(body.credits);
    if (!amt || amt <= 0) return res.status(400).json({ ok: false, error: 'credits must be > 0' });
    const rsub = body.sub || (body.email ? await auth.findByEmail(body.email) : null);
    if (!rsub) return res.status(404).json({ ok: false, error: 'user_not_found' });
    const bal = await credits.balanceUser(rsub);
    const deduct = Math.min(bal, amt);
    if (deduct > 0) await credits.spendUser(rsub, deduct, 'admin_refund:' + (body.orderId || ''));
    console.log(JSON.stringify({ event: 'admin_refund', sub: rsub, requested: amt, deducted: deduct, shortfall: amt - deduct }));
    return res.status(200).json({ ok: true, sub: rsub, deducted: deduct, shortfall: amt - deduct, balance: bal - deduct });
  }

  const creditsNum = Number(body.credits);
  if (!creditsNum || creditsNum <= 0) return res.status(400).json({ ok: false, error: 'credits must be > 0' });

  let sub = body.sub || null;
  if (!sub && body.email) sub = await auth.findByEmail(body.email);
  if (!sub) return res.status(404).json({ ok: false, error: 'user_not_found', hint: '该邮箱还没注册，积分会等他登录后自动认领' });

  const out = await credits.grantUser(sub, creditsNum, body.note || 'admin_grant', { by: 'admin', orderId: body.orderId || null });
  console.log(JSON.stringify({ event: 'admin_grant', sub: sub, credits: creditsNum, note: body.note || '' }));
  return res.status(200).json({ ok: true, sub: sub, balance: out.balance });
}

async function handleRepair(req, res, body) {
  const jobId = String((req.query && req.query.jobId) || body.jobId || '').trim();
  const provider = String((req.query && req.query.provider) || body.provider || adapter.PROVIDER);

  if (jobId) {
    const orderKey = 'job:' + provider + ':' + jobId;
    const state = await reconcile.processKey(orderKey, { force: true });
    const rec = await credits.orderDone(orderKey);
    console.log(JSON.stringify({ event: 'admin_repair', jobKey: orderKey, state, userId: rec && rec.userId }));
    return res.status(200).json({
      ok: true,
      jobKey: orderKey,
      state: state,
      order: rec ? {
        userId: rec.userId,
        cost: rec.cost,
        resolution: rec.resolution,
        completed: !!rec.completed,
        refunded: !!rec.refunded,
        expired: !!rec.expired
      } : null
    });
  }

  const out = await reconcile.repairStuck(20);
  console.log(JSON.stringify(Object.assign({ event: 'admin_repair_scan' }, out)));
  return res.status(200).json(Object.assign({ ok: true }, out));
}

function locsFromSitemap(xml) {
  const out = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

async function handleIndexNow(req, res, body) {
  let urls = Array.isArray(body.urls) ? body.urls : null;

  if (!urls) {
    const sm = await fetch(INDEXNOW_SITEMAP, { headers: { 'user-agent': 'zombie-couple-indexnow/1.0' } });
    if (!sm.ok) return res.status(502).json({ ok: false, error: 'sitemap_unreachable', status: sm.status });
    urls = locsFromSitemap(await sm.text());
  }

  urls = urls.filter((u) => typeof u === 'string' && u.startsWith('https://'));
  if (!urls.length) return res.status(400).json({ ok: false, error: 'no_urls' });

  const payload = { host: INDEXNOW_SITE, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList: urls.slice(0, 10000) };
  const r = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  return res.status(200).json({
    ok: r.status === 200 || r.status === 202,
    submitted: payload.urlList.length,
    status: r.status,
    urls: payload.urlList,
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!adminSecret()) return res.status(501).json({ ok: false, error: 'admin_disabled' });
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'bad_token' });
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const action = actionOf(req, body);

  try {
    if (action === 'list') {
      return res.status(200).json({ ok: true, pending: await billing.listPending() });
    }
    if (action === 'grant' || action === 'refund') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'method not allowed' });
      }
      return await handleGrant(req, res, body);
    }
    if (action === 'repair') return await handleRepair(req, res, body);
    if (action === 'indexnow') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'method not allowed' });
      }
      return await handleIndexNow(req, res, body);
    }
    return res.status(400).json({ ok: false, error: 'unknown_action', action: action });
  } catch (e) {
    console.error(JSON.stringify({ event: 'admin_failed', action: action, error: e.message }));
    return res.status(500).json({ ok: false, error: e.message });
  }
};
