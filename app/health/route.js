import { usingRedis } from '@/lib/store';

export const dynamic = 'force-dynamic';

// storage/config mode only — no values. "file" in production means data is lost on redeploy.
export function GET() {
  return Response.json({
    status: 'ok',
    store: usingRedis ? 'redis' : 'file',
    sessionSecret: Boolean(process.env.SESSION_SECRET),
    bootstrapAdmin: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
  });
}
