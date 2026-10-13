// Domain model: users, products, settings, templates, form versions,
// cases (+ survey link fields), responses, follow-ups, audit log.
import * as store from './store.js';
import { token as randToken, uid, hashPassword } from './ids.js';
import { yymm, businessDeadline } from './time.js';

export const CHANNELS = [
  { id: 'line', label: 'LINE OA' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'email', label: 'อีเมล' },
  { id: 'sms', label: 'SMS' },
  { id: 'phone', label: 'โทรศัพท์' },
];
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.id, c.label]));

export const SCORE_LABELS = ['แย่มาก', 'ไม่ค่อยดี', 'พอใช้', 'ดี', 'ดีมาก'];
export const RESOLVED = [
  { id: 'yes', label: 'แก้ได้แล้ว' },
  { id: 'partial', label: 'แก้ได้บางส่วน' },
  { id: 'no', label: 'ยังไม่ได้' },
];
export const RESOLVED_LABEL = Object.fromEntries(RESOLVED.map((r) => [r.id, r.label]));

export const LINK_STATUS_LABEL = { created: 'สร้างแล้ว', opened: 'เปิดดูแล้ว', answered: 'ตอบแล้ว', expired: 'หมดอายุ' };
export const FU_STATUS_LABEL = { pending: 'รอติดตาม', contacted: 'ติดต่อแล้ว', closed: 'ปิดเรื่อง', cancelled: 'ยกเลิก (คะแนนถูกแก้เป็น 4–5)' };

export const COMMENT_MAX = 500;

/* ============================ defaults ============================ */
const DEFAULT_PRODUCTS = [
  {
    code: 'BS',
    name: 'BoostSMS',
    color: '#1E6FF0',
    logo: '/logos/bs.png',
    contact: 'LINE @boostsms · โทร 02-124-3423 · support@boost-sms.com',
    active: true,
  },
  {
    code: 'EC',
    name: 'EasyCRM',
    color: '#1877F2',
    logo: '/logos/ec.png',
    contact: 'ติดต่อทีมซัพพอร์ต EasyCRM ผ่านช่องทางเดิมที่คุณใช้งาน',
    active: true,
  },
];

const DEFAULT_SETTINGS = {
  csatTarget: 90,
  responseRateTarget: 40,
  sendRateTarget: 100,
  linkTtlDays: 7,
  minSample: 30,
  minAgentSample: 10,
  privacyUrl: 'https://www.thunder.in.th/privacy-policy',
  orgName: 'Thunder Solution Co., Ltd.',
  holidays: [],
  alertEmails: [],
  // Google sign-in from this domain creates the account automatically (no admin step)
  autoJoinDomain: (process.env.GOOGLE_HD || 'thunder.in.th').toLowerCase(),
  autoJoinRole: 'agent',
};

export const DEFAULT_FORM = {
  scoreQuestion: 'คุณพึงพอใจกับการให้บริการของทีมซัพพอร์ตในเคสนี้แค่ไหน',
  improveQuestion: 'ควรปรับปรุงเรื่องใด (เลือกได้หลายข้อ)',
  improveOptions: ['ตอบกลับช้า', 'แก้ปัญหาไม่ตรงจุด', 'ต้องติดต่อหลายครั้ง', 'อธิบายไม่ชัดเจน', 'ไม่สุภาพ / ไม่ใส่ใจ', 'ตัวระบบ / ผลิตภัณฑ์มีปัญหา', 'อื่น ๆ'],
  impressQuestion: 'คุณประทับใจเรื่องใด (เลือกได้หลายข้อ)',
  impressOptions: ['ตอบกลับรวดเร็ว', 'แก้ปัญหาได้ตรงจุด', 'อธิบายชัดเจน เข้าใจง่าย', 'สุภาพ เป็นกันเอง', 'ติดตามผลจนจบ', 'อื่น ๆ'],
  resolvedQuestion: 'ปัญหาของคุณได้รับการแก้ไขแล้วหรือยัง',
  commentQuestion: 'ความเห็นเพิ่มเติม (ไม่บังคับ)',
};

const CHAT_TPL =
  'สวัสดีค่ะ ขอบคุณที่ใช้บริการ {product} นะคะ 🙏\nรบกวนช่วยประเมินการให้บริการของ {agent} ในเคส {case} หน่อยนะคะ ใช้เวลาไม่ถึง 30 วินาที\n{link}';
export const DEFAULT_TEMPLATES = {
  line: CHAT_TPL,
  messenger: CHAT_TPL,
  email:
    'หัวข้อ: ช่วยประเมินบริการของ {product} เคส {case}\n\nเรียนลูกค้า {product}\n\nขอบคุณที่ติดต่อทีมซัพพอร์ตของเรา รบกวนสละเวลาไม่ถึง 30 วินาทีประเมินการให้บริการในเคส {case} ผ่านลิงก์ด้านล่าง เพื่อให้เราพัฒนาบริการให้ดียิ่งขึ้น\n\n{link}\n\nลิงก์นี้ใช้ได้ {days} วัน\n\nขอบคุณค่ะ\n{agent} · ทีมซัพพอร์ต {product}',
  sms: '{product}: ช่วยประเมินบริการเคส {case} (30 วิ) {link}',
  phone: 'ขอบคุณที่ใช้บริการ {product} ค่ะ เดี๋ยว{agent}ส่งลิงก์แบบประเมินสั้น ๆ ให้ทาง SMS/แชตนะคะ ใช้เวลาไม่ถึง 30 วินาที\n{link}',
};

/* ============================== seed ============================== */
export async function ensureSeed() {
  if (globalThis.__pcsatSeeded) return;
  if (!(await store.get('seeded'))) {
    if (!(await store.get('products'))) await store.set('products', DEFAULT_PRODUCTS);
    if (!(await store.get('settings'))) await store.set('settings', DEFAULT_SETTINGS);
    if (!(await store.get('form:cur'))) {
      await store.set('form:v1', { version: 1, createdAt: new Date().toISOString(), ...DEFAULT_FORM });
      await store.set('form:cur', 1);
    }
    await store.set('seeded', true);
  }
  const ids = await store.smembers('users');
  if (!ids.length && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await createUser(null, {
      email: process.env.ADMIN_EMAIL,
      name: process.env.ADMIN_NAME || 'Admin',
      nickname: process.env.ADMIN_NICKNAME || 'Admin',
      role: 'admin',
      password: process.env.ADMIN_PASSWORD,
    });
  }
  globalThis.__pcsatSeeded = true;
}

/* ============================== audit ============================= */
export async function audit(user, action, detail = {}) {
  await store.lpush('audit', {
    at: new Date().toISOString(),
    by: user ? `${user.nickname || user.name} <${user.email}>` : 'system',
    action,
    detail,
  });
}
export const listAudit = (n = 200) => store.lrange('audit', 0, n - 1);

/* ============================== users ============================= */
const normEmail = (e) => String(e || '').trim().toLowerCase();
const err = (msg, status = 400) => Object.assign(new Error(msg), { status });

export const getUser = (id) => store.get(`user:${id}`);

export async function getUserByEmail(email) {
  const id = await store.get(`uemail:${normEmail(email)}`);
  return id ? getUser(id) : null;
}

export async function listUsers() {
  const ids = await store.smembers('users');
  const rows = (await store.mget(ids.map((i) => `user:${i}`))).filter(Boolean);
  return rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
}

/** "somchai.k@thunder.in.th" → "Somchai" — placeholder until the person signs in with Google. */
export function nameFromEmail(email) {
  const local = String(email).split('@')[0].split(/[._\-+]/)[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export async function createUser(by, { email, name, nickname, role = 'agent', password, via = 'admin' }) {
  email = normEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err(`อีเมลไม่ถูกต้อง: ${email}`);
  if (!['agent', 'lead', 'admin'].includes(role)) throw err('บทบาทไม่ถูกต้อง');
  if (await store.get(`uemail:${email}`)) throw err(`มีผู้ใช้อีเมลนี้แล้ว: ${email}`);
  if (password && String(password).length < 8) throw err('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
  const auto = !name;
  const u = {
    id: uid('u_'),
    email,
    name: String(name || nameFromEmail(email)).trim(),
    nickname: String(nickname || name || nameFromEmail(email)).trim(),
    autoName: auto, // replaced by the Google profile name on first sign-in
    role,
    active: true,
    passHash: password ? hashPassword(password) : null,
    createdAt: new Date().toISOString(),
    createdVia: via,
    lastLoginAt: null,
  };
  await store.set(`user:${u.id}`, u);
  await store.set(`uemail:${email}`, u.id);
  await store.sadd('users', u.id);
  await audit(by, 'user.create', { email, role, via });
  return u;
}

/** Paste-a-list: accepts emails separated by newlines, commas or spaces. Skips existing ones. */
export async function createUsers(by, text, role = 'agent') {
  const emails = [...new Set(String(text || '').split(/[\s,;]+/).map(normEmail).filter(Boolean))];
  if (!emails.length) throw err('กรุณาใส่อีเมลอย่างน้อย 1 รายการ');
  const created = [];
  const skipped = [];
  for (const e of emails) {
    try {
      created.push(await createUser(by, { email: e, role }));
    } catch (x) {
      skipped.push({ email: e, reason: x.message });
    }
  }
  return { created, skipped };
}

/** Record a sign-in; fill name/nickname from Google the first time. */
export async function touchLogin(u, profile = {}) {
  u.lastLoginAt = new Date().toISOString();
  if (u.autoName && (profile.name || profile.given_name)) {
    u.name = profile.name || profile.given_name;
    u.nickname = profile.given_name || profile.name;
    u.autoName = false;
  }
  if (profile.picture) u.picture = profile.picture;
  await store.set(`user:${u.id}`, u);
  return u;
}

/* ---------------- passwordless sign-in links (invite / magic link) ---------------- */
const LOGIN_LINK_DAYS = 7;

export async function createLoginToken(u) {
  const t = randToken(32);
  await store.set(`login:${t}`, { uid: u.id, exp: Date.now() + LOGIN_LINK_DAYS * 86400000 });
  return t;
}

/** Single-use: returns the user and burns the token. */
export async function consumeLoginToken(t) {
  if (!/^[A-Za-z0-9]{32}$/.test(String(t))) return null;
  const rec = await store.get(`login:${t}`);
  if (!rec) return null;
  await store.del(`login:${t}`);
  if (Date.now() > rec.exp) return null;
  const u = await getUser(rec.uid);
  return u && u.active !== false ? u : null;
}

/** Google sign-in for an unknown email: auto-create when the domain is allowed. */
export async function autoProvision(claims) {
  const s = await getSettings();
  const email = normEmail(claims.email);
  const domain = email.split('@')[1];
  if (!s.autoJoinDomain || domain !== s.autoJoinDomain) return null;
  const first = !(await store.smembers('users')).length;
  const u = await createUser(null, {
    email,
    name: claims.name || claims.given_name,
    nickname: claims.given_name || claims.name,
    role: first ? 'admin' : s.autoJoinRole || 'agent',
    via: 'google-auto',
  });
  return u;
}

export async function updateUser(by, id, patch) {
  const u = await getUser(id);
  if (!u) throw err('ไม่พบผู้ใช้', 404);
  const before = { role: u.role, active: u.active };
  if (patch.name != null) u.name = String(patch.name).trim();
  if (patch.nickname != null) {
    u.nickname = String(patch.nickname).trim().slice(0, 40);
    u.autoName = false;
  }
  if (patch.role != null) {
    if (!['agent', 'lead', 'admin'].includes(patch.role)) throw err('บทบาทไม่ถูกต้อง');
    u.role = patch.role;
  }
  if (patch.active != null) u.active = Boolean(patch.active);
  if (patch.password) {
    if (String(patch.password).length < 8) throw err('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
    u.passHash = hashPassword(patch.password);
  }
  await store.set(`user:${id}`, u);
  await audit(by, 'user.update', {
    email: u.email,
    ...(patch.role != null && patch.role !== before.role ? { role: `${before.role} → ${u.role}` } : {}),
    ...(patch.active != null && patch.active !== before.active ? { active: u.active } : {}),
    ...(patch.password ? { password: 'reset' } : {}),
  });
  return u;
}

/* ===================== products / settings / form ================= */
export async function getProducts(all = false) {
  const p = (await store.get('products')) || DEFAULT_PRODUCTS;
  return all ? p : p.filter((x) => x.active !== false);
}
export async function getProduct(code) {
  return (await getProducts(true)).find((p) => p.code === code) || null;
}

export async function saveProduct(by, input) {
  const code = String(input.code || '').trim().toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(code)) throw err('รหัสผลิตภัณฑ์ต้องเป็นตัวอักษรอังกฤษ 2–4 ตัว');
  if (!String(input.name || '').trim()) throw err('กรุณาใส่ชื่อผลิตภัณฑ์');
  const list = await getProducts(true);
  const idx = list.findIndex((p) => p.code === code);
  const rec = {
    ...(idx >= 0 ? list[idx] : {}),
    code,
    name: String(input.name).trim(),
    color: /^#[0-9a-fA-F]{6}$/.test(input.color || '') ? input.color : '#1E6FF0',
    logo: String(input.logo || '').trim(),
    contact: String(input.contact || '').trim(),
    active: input.active !== false,
  };
  if (idx >= 0) list[idx] = rec;
  else list.push(rec);
  await store.set('products', list);
  await audit(by, idx >= 0 ? 'product.update' : 'product.create', { code, name: rec.name, active: rec.active });
  return rec;
}

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...((await store.get('settings')) || {}) };
}

export async function saveSettings(by, patch) {
  const cur = await getSettings();
  const num = (v, lo, hi) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < lo || n > hi) throw err('ค่าตัวเลขไม่ถูกต้อง');
    return n;
  };
  const next = { ...cur };
  if (patch.csatTarget != null) next.csatTarget = num(patch.csatTarget, 0, 100);
  if (patch.responseRateTarget != null) next.responseRateTarget = num(patch.responseRateTarget, 0, 100);
  if (patch.sendRateTarget != null) next.sendRateTarget = num(patch.sendRateTarget, 0, 100);
  if (patch.linkTtlDays != null) next.linkTtlDays = num(patch.linkTtlDays, 1, 60);
  if (patch.minSample != null) next.minSample = num(patch.minSample, 1, 1000);
  if (patch.minAgentSample != null) next.minAgentSample = num(patch.minAgentSample, 1, 1000);
  if (patch.privacyUrl != null) next.privacyUrl = String(patch.privacyUrl).trim();
  if (patch.holidays != null)
    next.holidays = String(patch.holidays)
      .split(/[\s,]+/)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (patch.alertEmails != null)
    next.alertEmails = String(patch.alertEmails)
      .split(/[\s,]+/)
      .map(normEmail)
      .filter((e) => e.includes('@'));
  if (patch.autoJoinDomain != null) next.autoJoinDomain = String(patch.autoJoinDomain).trim().toLowerCase().replace(/^@/, '');
  if (patch.autoJoinRole != null && ['agent', 'lead'].includes(patch.autoJoinRole)) next.autoJoinRole = patch.autoJoinRole;
  await store.set('settings', next);
  const changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(cur[k]));
  if (changed.length) await audit(by, 'settings.update', Object.fromEntries(changed.map((k) => [k, next[k]])));
  return next;
}

export async function getTemplates() {
  return (await store.get('templates')) || {};
}
/** Template for product+channel: product override → channel default. */
export async function templateFor(code, channel) {
  const t = await getTemplates();
  return t[`${code}|${channel}`] || t[`*|${channel}`] || DEFAULT_TEMPLATES[channel] || CHAT_TPL;
}
export async function saveTemplate(by, key, text) {
  if (!/^[A-Z*]{1,4}\|[a-z]+$/.test(key)) throw err('คีย์เทมเพลตไม่ถูกต้อง');
  const t = await getTemplates();
  if (String(text || '').trim()) t[key] = String(text);
  else delete t[key];
  await store.set('templates', t);
  await audit(by, 'template.update', { key });
  return t;
}

export async function currentFormVersion() {
  return Number(await store.get('form:cur')) || 1;
}
export async function getForm(version) {
  const v = version || (await currentFormVersion());
  return (await store.get(`form:v${v}`)) || { version: v, ...DEFAULT_FORM };
}
export async function saveForm(by, input) {
  const cur = await getForm();
  const clean = (arr) =>
    (Array.isArray(arr) ? arr : String(arr || '').split('\n'))
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 15);
  const next = {
    scoreQuestion: String(input.scoreQuestion || cur.scoreQuestion).trim(),
    improveQuestion: String(input.improveQuestion || cur.improveQuestion).trim(),
    improveOptions: clean(input.improveOptions ?? cur.improveOptions),
    impressQuestion: String(input.impressQuestion || cur.impressQuestion).trim(),
    impressOptions: clean(input.impressOptions ?? cur.impressOptions),
    resolvedQuestion: String(input.resolvedQuestion || cur.resolvedQuestion).trim(),
    commentQuestion: String(input.commentQuestion || cur.commentQuestion).trim(),
  };
  if (!next.improveOptions.length || !next.impressOptions.length) throw err('ต้องมีตัวเลือกอย่างน้อย 1 ข้อ');
  const same = Object.keys(next).every((k) => JSON.stringify(next[k]) === JSON.stringify(cur[k]));
  if (same) return cur;
  const version = (await currentFormVersion()) + 1;
  const rec = { version, createdAt: new Date().toISOString(), createdBy: by?.email, ...next };
  await store.set(`form:v${version}`, rec);
  await store.set('form:cur', version);
  await audit(by, 'form.update', { version });
  return rec;
}

/* ====================== cases + survey links ====================== */
export const caseKey = (no) => `case:${no}`;

export async function createCase(user, { product, channel, extRef, parentCase }) {
  const p = await getProduct(product);
  if (!p || p.active === false) throw err('ไม่พบผลิตภัณฑ์');
  if (!CHANNEL_LABEL[channel]) throw err('ช่องทางไม่ถูกต้อง');
  const settings = await getSettings();
  const now = new Date();
  const ym4 = yymm(now);
  // FR-104: atomic per-product per-month counter → never duplicates.
  const n = await store.incr(`seq:${p.code}:${ym4}`);
  const no = `${p.code}-${ym4}-${String(n).padStart(4, '0')}`;

  let tok;
  for (let i = 0; i < 5; i++) {
    const t = randToken(10);
    if (await store.setnx(`tok:${t}`, no)) {
      tok = t;
      break;
    }
  }
  if (!tok) throw err('สร้างลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง', 500);

  const c = {
    no,
    product: p.code,
    agentId: user.id,
    agentName: user.name,
    agentNick: user.nickname || user.name,
    channel,
    extRef: String(extRef || '').trim().slice(0, 120),
    parentCase: parentCase || null,
    token: tok,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + settings.linkTtlDays * 86400000).toISOString(),
    openedAt: null,
  };
  await store.set(caseKey(no), c);
  await store.sadd(`cases:${ym4}`, no);
  if (user.lastProduct !== p.code || user.lastChannel !== channel) {
    const fresh = await getUser(user.id);
    if (fresh) await store.set(`user:${user.id}`, { ...fresh, lastProduct: p.code, lastChannel: channel });
  }
  return c;
}

export async function getCase(no) {
  return store.get(caseKey(no));
}

export async function caseByToken(tok) {
  const no = await store.get(`tok:${tok}`);
  return no ? getCase(no) : null;
}

export async function markOpened(c) {
  if (c.openedAt) return c;
  c.openedAt = new Date().toISOString();
  await store.set(caseKey(c.no), c);
  return c;
}

export function linkStatus(c, r, now = Date.now()) {
  if (r) return 'answered';
  if (now > new Date(c.expiresAt).getTime()) return 'expired';
  return c.openedAt ? 'opened' : 'created';
}

/** Load full case bundles (case + response + follow-up) for a set of creation months. */
export async function loadBundles(yymms) {
  const sets = await Promise.all(yymms.map((m) => store.smembers(`cases:${m}`)));
  const nos = [...new Set(sets.flat())];
  if (!nos.length) return [];
  const [cs, rs, fs] = await Promise.all([
    store.mget(nos.map((n) => `case:${n}`)),
    store.mget(nos.map((n) => `resp:${n}`)),
    store.mget(nos.map((n) => `fu:${n}`)),
  ]);
  const now = Date.now();
  return nos
    .map((no, i) => cs[i] && { case: cs[i], resp: rs[i], fu: fs[i], status: linkStatus(cs[i], rs[i], now) })
    .filter(Boolean)
    .sort((a, b) => (a.case.createdAt < b.case.createdAt ? 1 : -1));
}

export async function getBundle(no) {
  const c = await getCase(no);
  if (!c) return null;
  const [r, f] = await Promise.all([store.get(`resp:${no}`), store.get(`fu:${no}`)]);
  return { case: c, resp: r, fu: f, status: linkStatus(c, r) };
}

/* ============================ responses =========================== */
export const getResponse = (no) => store.get(`resp:${no}`);

/**
 * Save the score (FR-308: on star tap) and optionally the rest of the answer.
 * Returns { resp, lowScoreEvent } where lowScoreEvent ∈ null|'new'|'final'.
 */
export async function saveResponse(c, input, { final }) {
  const now = new Date();
  if (now > new Date(c.expiresAt)) throw err('expired', 410);
  let r = await getResponse(c.no);
  if (r?.final) throw err('answered', 409);

  const score = Number(input.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw err('กรุณาเลือกคะแนน 1–5');
  const form = await getForm(r?.formVersion);

  const first = !r;
  r = r || {
    caseNo: c.no,
    token: c.token,
    product: c.product,
    agentId: c.agentId,
    channel: c.channel,
    formVersion: form.version,
    answeredAt: now.toISOString(),
    reasons: [],
    resolved: null,
    comment: '',
    final: false,
  };
  const prevScore = r.score;
  r.score = score;
  r.updatedAt = now.toISOString();

  if (final) {
    const allowed = score <= 3 ? form.improveOptions : form.impressOptions;
    r.reasons = (Array.isArray(input.reasons) ? input.reasons : []).filter((x) => allowed.includes(x)).slice(0, 15);
    r.resolved = RESOLVED_LABEL[input.resolved] ? input.resolved : null;
    if (!r.resolved) throw err('กรุณาตอบว่าปัญหาได้รับการแก้ไขแล้วหรือยัง');
    r.comment = String(input.comment || '').trim().slice(0, COMMENT_MAX);
    r.final = true;
    r.finalAt = now.toISOString();
  }
  await store.set(`resp:${c.no}`, r);

  let lowScoreEvent = null;
  const fu = await store.get(`fu:${c.no}`);
  if (score <= 3) {
    if (!fu) {
      const settings = await getSettings();
      await store.set(`fu:${c.no}`, {
        caseNo: c.no,
        assigneeId: c.agentId,
        status: 'pending',
        notes: [],
        createdAt: now.toISOString(),
        deadline: new Date(businessDeadline(now, 1, settings.holidays)).toISOString(),
        contactedAt: null,
        closedAt: null,
        remindedAt: null,
      });
      await store.sadd('fu:open', c.no);
      lowScoreEvent = 'new';
    } else if (fu.status === 'cancelled') {
      fu.status = 'pending';
      fu.notes.push({ at: now.toISOString(), by: 'system', text: `ลูกค้าเปลี่ยนคะแนนกลับเป็น ${score}` });
      await store.set(`fu:${c.no}`, fu);
      await store.sadd('fu:open', c.no);
      lowScoreEvent = 'new';
    } else if (final) {
      lowScoreEvent = 'final';
    }
    if (lowScoreEvent === 'new' && final) lowScoreEvent = 'new+final';
  } else if (fu && fu.status === 'pending' && !fu.contactedAt) {
    fu.status = 'cancelled';
    fu.notes.push({ at: now.toISOString(), by: 'system', text: `ลูกค้าเปลี่ยนคะแนนจาก ${prevScore} เป็น ${score}` });
    await store.set(`fu:${c.no}`, fu);
  }
  return { resp: r, lowScoreEvent, first };
}

/* ============================ follow-ups ========================== */
export async function listOpenFollowups() {
  const nos = await store.smembers('fu:open');
  if (!nos.length) return [];
  const fs = await store.mget(nos.map((n) => `fu:${n}`));
  return fs.filter(Boolean);
}

export async function updateFollowup(user, no, { status, note, assigneeId }) {
  const fu = await store.get(`fu:${no}`);
  if (!fu) throw err('ไม่พบรายการติดตาม', 404);
  const c = await getCase(no);
  const isLead = user.role === 'lead' || user.role === 'admin';
  if (!isLead && fu.assigneeId !== user.id && c?.agentId !== user.id) throw err('ไม่มีสิทธิ์', 403);
  const now = new Date().toISOString();
  const by = user.nickname || user.name;

  if (assigneeId && assigneeId !== fu.assigneeId) {
    if (!isLead) throw err('เฉพาะหัวหน้าทีมที่มอบหมายงานได้', 403);
    const a = await getUser(assigneeId);
    if (!a) throw err('ไม่พบผู้ใช้');
    fu.assigneeId = assigneeId;
    fu.notes.push({ at: now, by, text: `มอบหมายให้ ${a.nickname || a.name}` });
  }
  if (status && status !== fu.status) {
    if (!['pending', 'contacted', 'closed'].includes(status)) throw err('สถานะไม่ถูกต้อง');
    if (status === 'contacted' && !fu.contactedAt) fu.contactedAt = now;
    if (status === 'closed') {
      fu.closedAt = now;
      if (!fu.contactedAt) fu.contactedAt = now;
    }
    if (status !== 'closed') fu.closedAt = null;
    fu.notes.push({ at: now, by, text: `สถานะ: ${FU_STATUS_LABEL[fu.status]} → ${FU_STATUS_LABEL[status]}` });
    fu.status = status;
  }
  if (note && String(note).trim()) fu.notes.push({ at: now, by, text: String(note).trim().slice(0, 1000) });
  await store.set(`fu:${no}`, fu);
  if (fu.status === 'closed') await store.srem('fu:open', no);
  else await store.sadd('fu:open', no);
  return fu;
}

/* ======================= closed-case counts ======================= */
export async function getClosedCounts(months) {
  const rows = await store.mget(months.map((m) => `closed:${m}`));
  return Object.fromEntries(months.map((m, i) => [m, rows[i] || {}]));
}
export async function setClosedCount(by, month, product, count) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw err('เดือนไม่ถูกต้อง');
  const cur = (await store.get(`closed:${month}`)) || {};
  if (count === '' || count == null) delete cur[product];
  else {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 0) throw err('จำนวนไม่ถูกต้อง');
    cur[product] = n;
  }
  await store.set(`closed:${month}`, cur);
  await audit(by, 'closedCount.set', { month, product, count });
  return cur;
}
