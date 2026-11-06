import { json, bad } from '@/lib/http';
import { sweep } from '@/lib/sweep';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: an unset secret must not leave the endpoint open.
  if (!secret && process.env.NODE_ENV === 'production') return bad('CRON_SECRET is not set', 503);
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return bad('unauthorized', 401);
  return json(await sweep(req, { force: true }));
}
