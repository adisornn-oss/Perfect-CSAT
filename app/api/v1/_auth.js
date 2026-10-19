import { keyFromRequest } from '@/lib/integrations';
import { limited } from '@/lib/ratelimit';

const fail = (msg, status) => Object.assign(new Error(msg), { status });

/** Bearer API key + 300 requests/min per key. */
export async function requireKey(req) {
  const k = await keyFromRequest(req);
  if (!k) throw fail('invalid or missing API key (Authorization: Bearer pcs_…)', 401);
  if (await limited('api', k.id, 300, 60)) throw fail('rate limit: 300 requests/minute', 429);
  return k;
}
