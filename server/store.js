/**
 * 键值存储（Vercel KV / Upstash REST，零 SDK 依赖）
 *
 * 生产：在 Vercel 项目里开通 KV（或 Upstash）后会自动注入
 *   KV_REST_API_URL / KV_REST_API_TOKEN
 * 本地/未配置：退化为进程内内存存储（仅自测用，serverless 重启即丢）
 */
const REST_URL = process.env.KV_REST_API_URL || '';
const REST_TOKEN = process.env.KV_REST_API_TOKEN || '';
const memory = new Map();

function hasRest() {
  return !!(REST_URL && REST_TOKEN);
}

async function cmd(args) {
  const r = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + REST_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error('kv http ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (j && j.error) throw new Error('kv error: ' + j.error);
  return j && j.result;
}

// 内存模式下的最小实现
function memCmd(args) {
  const [op, k, v] = args;
  if (op === 'SET') { memory.set(k, String(v)); return 'OK'; }
  if (op === 'GET') { const x = memory.get(k); return x === undefined ? null : x; }
  if (op === 'DEL') { memory.delete(k); return 1; }
  if (op === 'INCRBY') {
    const cur = Number(memory.get(k) || 0);
    memory.set(k, String(cur + Number(v)));
    return cur + Number(v);
  }
  if (op === 'RPUSH') {
    const arr = JSON.parse(memory.get(k) || '[]');
    arr.push(v);
    memory.set(k, JSON.stringify(arr));
    return arr.length;
  }
  if (op === 'LRANGE') {
    const arr = JSON.parse(memory.get(k) || '[]');
    return arr.slice(Number(v) /* start */, Number(args[3]) + 1 || undefined);
  }
  if (op === 'LREM') {
    // v 是 count，args[3] 已经和 RPUSH 写入的格式一致（JSON 字符串）
    const arr = JSON.parse(memory.get(k) || '[]');
    const target = String(args[3]);
    const count = Number(v) || 0;
    let removed = 0;
    const next = arr.filter(function (x) {
      if (x !== target) return true;
      if (count === 0 || removed < count) { removed++; return false; }
      return true;
    });
    memory.set(k, JSON.stringify(next));
    return removed;
  }
  if (op === 'EXISTS') return memory.has(k) ? 1 : 0;
  throw new Error('mem: unsupported ' + op);
}

async function run(args) {
  return hasRest() ? cmd(args) : memCmd(args);
}

/**
 * 按 pattern 列出 key（Upstash SCAN）。仅 KV 模式可用，内存模式返回 []。
 * 运维自测用，生产代码不依赖它。
 */
async function scan(match, count) {
  if (!hasRest()) return [];
  const out = [];
  let cursor = '0';
  do {
    const r = await cmd(['SCAN', cursor, 'MATCH', match, 'COUNT', String(count || 200)]);
    if (!Array.isArray(r) || r.length < 2) break;
    cursor = String(r[0]);
    (r[1] || []).forEach(function (k) { out.push(k); });
  } while (cursor !== '0' && out.length < 5000);
  return out;
}

/** 读一个 JSON 值（不存在返回 null） */
async function getJson(key) {
  const raw = await run(['GET', key]);
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return raw;
  }
}

async function setJson(key, value) {
  await run(['SET', key, JSON.stringify(value)]);
  return value;
}

async function getNumber(key) {
  const raw = await run(['GET', key]);
  return raw === null || raw === undefined ? null : Number(raw);
}

async function addNumber(key, delta) {
  return Number(await run(['INCRBY', key, delta]));
}

async function push(key, entry) {
  await run(['RPUSH', key, JSON.stringify(entry)]);
}

/** 从列表移除元素（count=0 移除全部）；值按 push 时的 JSON 格式比对 */
async function lrem(key, value, count) {
  return Number(await run(['LREM', key, String(count || 0), JSON.stringify(value)]));
}

async function list(key, limit) {
  const items = await run(['LRANGE', key, 0, (limit || 100) - 1]);
  return (items || []).map((x) => {
    try {
      return typeof x === 'string' ? JSON.parse(x) : x;
    } catch (e) {
      return x;
    }
  });
}

async function del(key) {
  await run(['DEL', key]);
}

module.exports = {
  scan,
  hasRest,
  getJson,
  setJson,
  getNumber,
  addNumber,
  push,
  lrem,
  list,
  del,
  // 供测试注入
  _memory: memory
};
