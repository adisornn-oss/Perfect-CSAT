import { handler, json, qs } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { computeStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const u = await requireRole('agent');
  return json(await computeStats(qs(req), u));
});
