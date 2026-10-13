import { handler, json, body } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { updateFollowup } from '@/lib/data';

export const PATCH = handler(async (req, { params }) => {
  const u = await requireRole('agent');
  const fu = await updateFollowup(u, decodeURIComponent(params.no).toUpperCase(), await body(req));
  return json({ fu });
});
