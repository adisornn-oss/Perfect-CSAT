// Tiny KV abstraction: Upstash Redis when configured, JSON file otherwise.
// The file driver keeps local dev fully functional without any credentials.
import fs from 'fs';
import path from 'path';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const usingRedis = Boolean(URL_ && TOKEN);

// Every key is namespaced so this app can share one Redis instance with
// other projects (Upstash free tier allows only one database per account).
const NS = process.env.KV_PREFIX ?? 'pcsat:';
const k = (key) => NS + key;

/* ------------------------- redis driver ------------------------- */
let redis = null;
function R() {
  if (!redis) {
    // eslint-disable-next-line global-require
    const { Redis } = require('@upstash/redis');
    redis = new Redis({ url: URL_, token: TOKEN, automaticDeserialization: false });
  }
  return redis;
}

/* -------------------------- file driver ------------------------- */
const FILE = path.join(process.cwd(), '.data', 'db.json');
const g = globalThis;

function load() {
  if (g.__pcsatDb) return g.__pcsatDb;
  let db;
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    db = {};
  }
  db.kv ||= {};
  db.sets ||= {};
  db.lists ||= {};
  db.exp ||= {};
  g.__pcsatDb = db;
  return db;
}
function flush() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(g.__pcsatDb));
  } catch {
    /* read-only FS: keep in memory */
  }
}
function alive(db, key) {
  const e = db.exp[key];
  if (e && Date.now() > e) {
    delete db.kv[key];
    delete db.exp[key];
    return false;
  }
  return true;
}

const parse = (v) => {
  if (v == null) return null;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

/* ---------------------------- public ---------------------------- */
export async function get(key) {
  if (usingRedis) return parse(await R().get(k(key)));
  const db = load();
  return alive(db, k(key)) ? db.kv[k(key)] ?? null : null;
}

export async function mget(keys) {
  if (!keys.length) return [];
  if (usingRedis) {
    const out = [];
    for (let i = 0; i < keys.length; i += 500) {
      const chunk = keys.slice(i, i + 500).map(k);
      const vals = await R().mget(...chunk);
      out.push(...vals.map(parse));
    }
    return out;
  }
  const db = load();
  return keys.map((key) => (alive(db, k(key)) ? db.kv[k(key)] ?? null : null));
}

export async function set(key, value) {
  if (usingRedis) {
    await R().set(k(key), JSON.stringify(value));
    return value;
  }
  const db = load();
  db.kv[k(key)] = value;
  flush();
  return value;
}

/** SET only if absent. Returns true when the key was written. */
export async function setnx(key, value) {
  if (usingRedis) return (await R().set(k(key), JSON.stringify(value), { nx: true })) === 'OK';
  const db = load();
  if (alive(db, k(key)) && db.kv[k(key)] != null) return false;
  db.kv[k(key)] = value;
  flush();
  return true;
}

export async function del(key) {
  if (usingRedis) return void (await R().del(k(key)));
  const db = load();
  delete db.kv[k(key)];
  flush();
}

/** Atomic counter (INCR). Optional TTL (seconds) applied when first created. */
export async function incr(key, ttlSec) {
  if (usingRedis) {
    const n = await R().incr(k(key));
    if (ttlSec && n === 1) await R().expire(k(key), ttlSec);
    return n;
  }
  const db = load();
  const kk = k(key);
  alive(db, kk);
  db.kv[kk] = (Number(db.kv[kk]) || 0) + 1;
  if (ttlSec && db.kv[kk] === 1) db.exp[kk] = Date.now() + ttlSec * 1000;
  flush();
  return db.kv[kk];
}

export async function sadd(key, member) {
  if (usingRedis) return void (await R().sadd(k(key), member));
  const db = load();
  const s = (db.sets[k(key)] ||= []);
  if (!s.includes(member)) s.push(member);
  flush();
}

export async function srem(key, member) {
  if (usingRedis) return void (await R().srem(k(key), member));
  const db = load();
  db.sets[k(key)] = (db.sets[k(key)] || []).filter((m) => m !== member);
  flush();
}

export async function smembers(key) {
  if (usingRedis) return (await R().smembers(k(key))) || [];
  return load().sets[k(key)] || [];
}

export async function lpush(key, value, max = 2000) {
  if (usingRedis) {
    await R().lpush(k(key), JSON.stringify(value));
    await R().ltrim(k(key), 0, max - 1);
    return;
  }
  const db = load();
  const l = (db.lists[k(key)] ||= []);
  l.unshift(value);
  l.length = Math.min(l.length, max);
  flush();
}

export async function lrange(key, start, stop) {
  if (usingRedis) return ((await R().lrange(k(key), start, stop)) || []).map(parse);
  const l = load().lists[k(key)] || [];
  return l.slice(start, stop === -1 ? undefined : stop + 1);
}
