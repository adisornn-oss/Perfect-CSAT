import { json } from '@/lib/http';
import { clearCookie } from '@/lib/auth';

export async function POST() {
  const res = json({ ok: true });
  res.cookies.set(clearCookie());
  return res;
}
