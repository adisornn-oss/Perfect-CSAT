import { json, bad } from '@/lib/http';
import { sweep } from '@/lib/sweep';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return bad('unauthorized', 401);
  return json(await sweep(req, { force: true }));
}
