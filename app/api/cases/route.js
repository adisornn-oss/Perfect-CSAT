import { handler, body, json, qs } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { createCase, loadBundles, getBundle, getProducts, ensureSeed, SCORE_LABELS, CHANNELS } from '@/lib/data';
import { messageFor, surveyUrl } from '@/lib/message';
import { yymm, ym, shiftMonth, ymToYymm, monthsBetween } from '@/lib/time';

export const dynamic = 'force-dynamic';

function shape(req, b) {
  return {
    ...b.case,
    link: surveyUrl(req, b.case.token),
    status: b.status,
    score: b.resp?.score ?? null,
    scoreLabel: b.resp ? SCORE_LABELS[b.resp.score - 1] : null,
    final: Boolean(b.resp?.final),
    answeredAt: b.resp?.answeredAt || null,
    comment: b.resp?.comment || '',
    fuStatus: b.fu?.status || null,
  };
}

// FR-207: "my cases" (agents) / all cases (lead+), searchable by case number or external ref.
export const GET = handler(async (req) => {
  const u = await requireRole('agent');
  const q = qs(req);
  const term = String(q.q || '').trim().toUpperCase();
  let months = Math.min(Math.max(Number(q.months) || 2, 1), 24);
  // a full case number tells us exactly which month to read
  const m = term.match(/^([A-Z]{2,4})-(\d{4})-\d{1,5}$/);
  let yms;
  if (m) yms = [m[2]];
  else {
    const now = ym();
    if (term) months = Math.max(months, 6);
    yms = monthsBetween(shiftMonth(now, -(months - 1)), now).map(ymToYymm);
  }
  let rows = await loadBundles(yms);
  const scopeAll = q.scope === 'all' && u.role !== 'agent';
  if (!scopeAll) rows = rows.filter((b) => b.case.agentId === u.id);
  if (term) rows = rows.filter((b) => b.case.no.includes(term) || String(b.case.extRef || '').toUpperCase().includes(term));
  if (q.status) rows = rows.filter((b) => b.status === q.status);
  return json({ cases: rows.slice(0, 500).map((b) => shape(req, b)), currentYymm: yymm(), products: await getProducts(), channels: CHANNELS });
});

export const POST = handler(async (req) => {
  await ensureSeed();
  const u = await requireRole('agent');
  const input = await body(req);
  if (input.parentCase) {
    const parent = await getBundle(input.parentCase);
    if (!parent) throw Object.assign(new Error('ไม่พบเคสเดิม'), { status: 404 });
    if (u.role === 'agent' && parent.case.agentId !== u.id) throw Object.assign(new Error('ไม่มีสิทธิ์'), { status: 403 });
    input.product = parent.case.product;
    input.extRef = input.extRef ?? parent.case.extRef;
  }
  const c = await createCase(u, input);
  const msg = await messageFor(req, c);
  return json({ case: { ...c, link: msg.link, status: 'created' }, message: msg.text });
});
