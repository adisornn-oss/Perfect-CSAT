import { handler, json } from '@/lib/http';
import { getBundle } from '@/lib/data';
import { requireKey } from '../../_auth';
import { shape } from '../shape';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req, { params }) => {
  const k = await requireKey(req);
  const b = await getBundle(String(params.no).toUpperCase());
  // a key only sees the cases it created
  if (!b || b.case.apiKeyId !== k.id) throw Object.assign(new Error('not found'), { status: 404 });
  return json(shape(req, b));
});
