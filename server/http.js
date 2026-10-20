/**
 * Minimal JSON HTTP helper for serverless functions.
 * - timeout guard
 * - one retry on transient 5xx / network errors
 * - always returns parsed JSON (throws on non-2xx with body text attached)
 */

async function requestJson(url, options, timeoutMs) {
  const timeout = timeoutMs || 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      json = null;
    }
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status + ' from ' + url);
      err.status = res.status;
      err.body = text ? text.slice(0, 600) : '';
      throw err;
    }
    return json !== null ? json : {};
  } finally {
    clearTimeout(timer);
  }
}

async function requestJsonWithRetry(url, options, timeoutMs, retries) {
  const attempts = (retries || 0) + 1;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await requestJson(url, options, timeoutMs);
    } catch (e) {
      lastErr = e;
      const transient = !e.status || e.status >= 500 || e.status === 429;
      if (!transient || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function post(url, headers, body, timeoutMs, retries) {
  return requestJsonWithRetry(
    url,
    {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
      body: JSON.stringify(body || {})
    },
    timeoutMs,
    retries
  );
}

function get(url, headers, timeoutMs, retries) {
  return requestJsonWithRetry(url, { method: 'GET', headers: headers || {} }, timeoutMs, retries);
}

module.exports = { requestJson, requestJsonWithRetry, post, get };
