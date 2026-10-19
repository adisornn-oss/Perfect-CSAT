// Bot / chat-platform integrations: API keys, LINE Flex rating card, answer webhooks.
import crypto from 'crypto';
import * as store from './store.js';
import { token as randToken, uid } from './ids.js';
import { audit, getUserByEmail, getProduct, SCORE_LABELS } from './data.js';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const err = (msg, status = 400) => Object.assign(new Error(msg), { status });
const pub = ({ hash, ...k }) => k;

/* ============================ API keys ============================ */
// The raw key is shown once; only its SHA-256 is stored.
export async function createApiKey(by, { name, webhookUrl }) {
  name = String(name || '').trim().slice(0, 60);
  if (!name) throw err('ตั้งชื่อให้รู้ว่าเป็นบอทตัวไหน');
  webhookUrl = String(webhookUrl || '').trim();
  if (webhookUrl && !/^(https:\/\/|http:\/\/localhost[:/])/.test(webhookUrl)) throw err('Webhook ต้องเป็น https://');
  const raw = `pcs_${randToken(32)}`;
  const k = {
    id: uid('k_'),
    name,
    prefix: raw.slice(0, 8),
    hash: sha(raw),
    webhookUrl: webhookUrl || '',
    webhookSecret: webhookUrl ? `whs_${randToken(24)}` : '',
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: by.email,
    lastUsedAt: null,
  };
  await store.set(`apikey:${k.id}`, k);
  await store.set(`apikeyh:${k.hash}`, k.id);
  await store.sadd('apikeys', k.id);
  await audit(by, 'apikey.create', { id: k.id, name });
  return { key: pub(k), secret: raw };
}

export async function listApiKeys() {
  const ids = await store.smembers('apikeys');
  const keys = (await store.mget(ids.map((id) => `apikey:${id}`))).filter(Boolean);
  return keys.map(pub).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateApiKey(by, id, patch) {
  const k = await store.get(`apikey:${id}`);
  if (!k) throw err('ไม่พบคีย์', 404);
  if (patch.active === false) {
    k.active = false;
    await store.del(`apikeyh:${k.hash}`);
  }
  if (patch.webhookUrl !== undefined) {
    const w = String(patch.webhookUrl || '').trim();
    if (w && !/^(https:\/\/|http:\/\/localhost[:/])/.test(w)) throw err('Webhook ต้องเป็น https://');
    k.webhookUrl = w;
    if (w && !k.webhookSecret) k.webhookSecret = `whs_${randToken(24)}`;
  }
  await store.set(`apikey:${id}`, k);
  await audit(by, 'apikey.update', { id, ...patch });
  return pub(k);
}

/** Resolve `Authorization: Bearer pcs_…` → key record, or null. */
export async function keyFromRequest(req) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(pcs_[A-Za-z0-9]{32})$/);
  if (!m) return null;
  const id = await store.get(`apikeyh:${sha(m[1])}`);
  const k = id && (await store.get(`apikey:${id}`));
  if (!k?.active) return null;
  // last-used is informational — write at most once a minute
  if (!k.lastUsedAt || Date.now() - new Date(k.lastUsedAt).getTime() > 60000) {
    k.lastUsedAt = new Date().toISOString();
    await store.set(`apikey:${id}`, k);
  }
  return k;
}

/**
 * Whose case is this? A matching active staff email gets the credit (so per-agent CSAT works);
 * otherwise the case belongs to the bot itself.
 */
export async function actorFor(k, agentEmail) {
  if (agentEmail) {
    const u = await getUserByEmail(agentEmail);
    if (u && u.active !== false) return { user: u, matched: true };
  }
  return { user: { id: `bot:${k.id}`, name: k.name, nickname: k.name }, matched: false };
}

/* ========================= chat payloads ========================== */
export const ratingLinks = (link) => SCORE_LABELS.map((label, i) => ({ score: i + 1, label, url: `${link}?s=${i + 1}` }));

/** A LINE Flex message: tapping a star opens the survey with that score already saved. */
export async function lineFlex(c, link) {
  const p = await getProduct(c.product);
  const color = p?.color || '#1c1917';
  const star = (n) => ({
    type: 'box',
    layout: 'vertical',
    flex: 1,
    paddingAll: '6px',
    cornerRadius: '8px',
    backgroundColor: '#F5F5F4',
    action: { type: 'uri', label: `${n} ดาว`, uri: `${link}?s=${n}` },
    contents: [
      { type: 'text', text: '★', size: 'xl', align: 'center', color: n >= 4 ? color : '#A8A29E' },
      { type: 'text', text: String(n), size: 'xs', align: 'center', color: '#57534E' },
    ],
  });
  return {
    type: 'flex',
    altText: `ช่วยให้คะแนนการดูแลของ ${p?.name || c.product} (เคส ${c.no})`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `${p?.name || c.product} · เคส ${c.no}`, size: 'xxs', color: '#78716C' },
          { type: 'text', text: `ความพึงพอใจต่อการดูแลของ ${c.agentNick}`, weight: 'bold', size: 'md', wrap: true },
          { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: [1, 2, 3, 4, 5].map(star) },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: SCORE_LABELS[0], size: 'xxs', color: '#A8A29E' },
              { type: 'text', text: SCORE_LABELS[4], size: 'xxs', color: '#A8A29E', align: 'end' },
            ],
          },
          { type: 'text', text: 'ใช้เวลาไม่ถึง 1 นาที', size: 'xxs', color: '#A8A29E', margin: 'md' },
        ],
      },
    },
  };
}

/* ============================ webhooks ============================ */
/** Tell the bot the customer answered, so it can say thanks or hand over to a human. */
export async function notifyAnswered(c, r) {
  if (!c.apiKeyId) return;
  const k = await store.get(`apikey:${c.apiKeyId}`);
  if (!k?.active || !k.webhookUrl) return;
  const payload = JSON.stringify({
    event: r.final ? 'survey.completed' : 'survey.scored',
    caseNo: c.no,
    extRef: c.extRef || null,
    product: c.product,
    score: r.score,
    scoreLabel: SCORE_LABELS[r.score - 1],
    low: r.score <= 3,
    resolved: r.resolved,
    reasons: r.reasons,
    comment: r.comment,
    final: r.final,
    at: new Date().toISOString(),
  });
  const sig = crypto.createHmac('sha256', k.webhookSecret).update(payload).digest('hex');
  try {
    const res = await fetch(k.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PerfectCSAT-Signature': `sha256=${sig}` },
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error('bot webhook', k.id, res.status);
  } catch (e) {
    console.error('bot webhook', k.id, e.message);
  }
}
