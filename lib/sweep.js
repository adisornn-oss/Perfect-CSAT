// FR-503: remind leads when a low score has not been contacted within
// 1 business day. Runs from the daily cron and, throttled to once a minute,
// whenever staff pages hit the API (Vercel Hobby only allows daily crons).
import * as store from './store.js';
import { listOpenFollowups, getCase } from './data.js';
import { remindFollowup } from './notify.js';

export async function sweep(req, { force = false } = {}) {
  if (!force && (await store.incr('sweep:lock', 60)) > 1) return { skipped: true };
  const now = Date.now();
  let reminded = 0;
  for (const fu of await listOpenFollowups()) {
    if (fu.status !== 'pending' || fu.remindedAt || !fu.deadline) continue;
    if (now <= new Date(fu.deadline).getTime()) continue;
    const c = await getCase(fu.caseNo);
    if (!c) continue;
    fu.remindedAt = new Date().toISOString();
    await store.set(`fu:${fu.caseNo}`, fu);
    await remindFollowup(c, fu, req);
    reminded += 1;
  }
  return { reminded };
}
