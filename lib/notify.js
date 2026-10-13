// Low-score alerts (FR-501/503). Delivery targets are all optional and
// configured with env vars; every alert is also kept in an in-app outbox.
import * as store from './store.js';
import { listUsers, getSettings, getProduct, SCORE_LABELS, RESOLVED_LABEL, getUser } from './data.js';
import { fmt } from './time.js';

export function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (req) {
    const h = req.headers;
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`;
  }
  return 'http://localhost:3000';
}

async function recipients() {
  const s = await getSettings();
  if (s.alertEmails?.length) return s.alertEmails;
  return (await listUsers()).filter((u) => u.active !== false && (u.role === 'lead' || u.role === 'admin')).map((u) => u.email);
}

async function sendLine(text) {
  const tokenL = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_TO; // group / room / user id
  if (!tokenL || !to) return 'skipped';
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenL}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  return r.ok ? 'sent' : `error ${r.status}`;
}

async function sendWebhook(text) {
  const url = process.env.ALERT_WEBHOOK_URL; // Google Chat / Slack / Discord incoming webhook
  if (!url) return 'skipped';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text.slice(0, 1900) }),
  });
  return r.ok ? 'sent' : `error ${r.status}`;
}

async function sendEmail(subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'skipped';
  const to = await recipients();
  if (!to.length) return 'no recipients';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Perfect CSAT <onboarding@resend.dev>',
      to,
      subject,
      text,
    }),
  });
  return r.ok ? 'sent' : `error ${r.status}`;
}

async function deliver(kind, subject, text, caseNo) {
  const results = {};
  const jobs = [
    ['line', sendLine(text)],
    ['webhook', sendWebhook(text)],
    ['email', sendEmail(subject, text)],
  ];
  for (const [name, p] of jobs) {
    try {
      results[name] = await p;
    } catch (e) {
      results[name] = `error ${e.message}`;
    }
  }
  await store.lpush('outbox', { at: new Date().toISOString(), kind, caseNo, subject, text, results }, 500);
  return results;
}

export async function alertLowScore(c, r, event, req) {
  const p = await getProduct(c.product);
  const base = appUrl(req);
  const fu = await store.get(`fu:${c.no}`);
  const assignee = fu?.assigneeId ? await getUser(fu.assigneeId) : null;
  const lines = [
    `⚠️ คะแนนต่ำ ${r.score}/5 (${SCORE_LABELS[r.score - 1]})`,
    `เคส ${c.no} · ${p?.name || c.product} · ผู้ดูแล ${c.agentNick}`,
  ];
  if (r.final) {
    if (r.reasons?.length) lines.push(`ควรปรับปรุง: ${r.reasons.join(', ')}`);
    if (r.resolved) lines.push(`สถานะปัญหา: ${RESOLVED_LABEL[r.resolved]}`);
    if (r.comment) lines.push(`ความเห็น: "${r.comment}"`);
  } else {
    lines.push('(ลูกค้ากดคะแนนแล้ว กำลังกรอกรายละเอียด)');
  }
  if (event !== 'final') lines.push(`ต้องติดต่อกลับภายใน ${fmt(fu?.deadline)} · ผู้รับผิดชอบ ${assignee?.nickname || c.agentNick}`);
  lines.push(`${base}/followups?case=${c.no}`);
  const subj = event === 'final' ? `รายละเอียดคะแนนต่ำ ${c.no}` : `[Perfect CSAT] คะแนนต่ำ ${r.score}/5 เคส ${c.no}`;
  return deliver(event === 'final' ? 'low.detail' : 'low.new', subj, lines.join('\n'), c.no);
}

export async function remindFollowup(c, fu, req) {
  const assignee = fu.assigneeId ? await getUser(fu.assigneeId) : null;
  const text = [
    `⏰ เกิน 1 วันทำการแล้ว ยังไม่ได้ติดต่อลูกค้าเคส ${c.no}`,
    `ผู้รับผิดชอบ ${assignee?.nickname || c.agentNick} · ครบกำหนด ${fmt(fu.deadline)}`,
    `${appUrl(req)}/followups?case=${c.no}`,
  ].join('\n');
  return deliver('low.reminder', `[Perfect CSAT] เตือน: ยังไม่ได้ติดต่อเคส ${c.no}`, text, c.no);
}

export const listOutbox = (n = 100) => store.lrange('outbox', 0, n - 1);

export function channelsConfigured() {
  return {
    line: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_TO),
    webhook: Boolean(process.env.ALERT_WEBHOOK_URL),
    email: Boolean(process.env.RESEND_API_KEY),
  };
}
