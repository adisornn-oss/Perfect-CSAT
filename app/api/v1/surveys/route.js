// Public API for chatbots: create a survey link for a case and get chat-ready payloads back.
import { handler, json, body } from '@/lib/http';
import { createCase, getProducts, getBundle, loadBundles, ensureSeed, CHANNEL_LABEL } from '@/lib/data';
import { ym, shiftMonth, monthsBetween, ymToYymm } from '@/lib/time';
import { messageFor } from '@/lib/message';
import { actorFor, ratingLinks, lineFlex } from '@/lib/integrations';
import { requireKey } from '../_auth';
import { shape } from './shape';

export const dynamic = 'force-dynamic';

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

export const POST = handler(async (req) => {
  await ensureSeed();
  const k = await requireKey(req);
  const b = await body(req);

  // product by code ("TB") or name ("Thunder Bot")
  const want = String(b.product || '').trim().toLowerCase();
  const products = await getProducts();
  const p = products.find((x) => x.code.toLowerCase() === want || x.name.toLowerCase() === want);
  if (!p) throw fail(`unknown product — use one of: ${products.map((x) => x.code).join(', ')}`);
  const channel = b.channel || 'line';
  if (!CHANNEL_LABEL[channel]) throw fail(`unknown channel — use one of: ${Object.keys(CHANNEL_LABEL).join(', ')}`);

  let parentCase = null;
  if (b.parentCase) {
    const parent = await getBundle(String(b.parentCase).toUpperCase());
    if (!parent) throw fail('parentCase not found', 404);
    parentCase = parent.case.no;
  }

  const { user, matched } = await actorFor(k, b.agentEmail);
  const c = await createCase(user, { product: p.code, channel, extRef: b.extRef, parentCase, apiKeyId: k.id });
  const msg = await messageFor(req, c);
  return json(
    {
      caseNo: c.no,
      link: msg.link,
      expiresAt: c.expiresAt,
      agent: { matched, nickname: c.agentNick },
      message: msg.text,
      ratingLinks: ratingLinks(msg.link),
      line: await lineFlex(c, msg.link),
    },
    { status: 201 },
  );
});

// Look up surveys by the chat platform's own ID: GET /api/v1/surveys?extRef=U1234…
export const GET = handler(async (req) => {
  const k = await requireKey(req);
  const extRef = new URL(req.url).searchParams.get('extRef');
  if (!extRef) throw fail('extRef is required');
  const now = ym();
  const rows = await loadBundles(monthsBetween(shiftMonth(now, -2), now).map(ymToYymm));
  const hits = rows.filter((x) => x.case.apiKeyId === k.id && x.case.extRef === extRef);
  hits.sort((a, b) => b.case.createdAt.localeCompare(a.case.createdAt));
  return json({ surveys: hits.slice(0, 20).map((x) => shape(req, x)) });
});
