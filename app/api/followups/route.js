import { handler, json, qs } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { loadBundles, listOpenFollowups, getBundle, listUsers, getProducts, getForm } from '@/lib/data';
import { ym, shiftMonth, monthsBetween, ymToYymm } from '@/lib/time';
import { sweep } from '@/lib/sweep';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const u = await requireRole('agent');
  await sweep(req).catch(() => {});
  const q = qs(req);
  const months = Math.min(Math.max(Number(q.months) || 3, 1), 24);
  const now = ym();
  const recent = await loadBundles(monthsBetween(shiftMonth(now, -(months - 1)), now).map(ymToYymm));
  const byNo = new Map(recent.filter((b) => b.fu).map((b) => [b.case.no, b]));
  for (const fu of await listOpenFollowups()) {
    if (!byNo.has(fu.caseNo)) {
      const b = await getBundle(fu.caseNo);
      if (b) byNo.set(fu.caseNo, b);
    }
  }
  let rows = [...byNo.values()];
  if (u.role === 'agent') rows = rows.filter((b) => b.fu.assigneeId === u.id || b.case.agentId === u.id);
  rows.sort((a, b) => (a.fu.createdAt < b.fu.createdAt ? 1 : -1));
  const users = (await listUsers()).filter((x) => x.active !== false).map((x) => ({ id: x.id, name: x.nickname || x.name, role: x.role }));
  const forms = {};
  for (const b of rows) if (b.resp && !forms[b.resp.formVersion]) forms[b.resp.formVersion] = await getForm(b.resp.formVersion);
  return json({ rows, users, products: await getProducts(true), forms });
});
