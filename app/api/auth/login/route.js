import { handler, body, bad, json } from '@/lib/http';
import { ensureSeed, getUserByEmail, audit, touchLogin } from '@/lib/data';
import { checkPassword, ipOf } from '@/lib/ids';
import { sessionCookie } from '@/lib/auth';
import { limited } from '@/lib/ratelimit';

export const POST = handler(async (req) => {
  await ensureSeed();
  if (await limited('login', ipOf(req), 10, 900)) return bad('พยายามเข้าสู่ระบบบ่อยเกินไป รอ 15 นาทีแล้วลองใหม่', 429);
  const { email, password } = await body(req);
  const u = await getUserByEmail(email);
  if (!u || u.active === false || !checkPassword(password, u.passHash)) return bad('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401);
  await touchLogin(u);
  await audit(u, 'auth.login', { via: 'password' });
  const res = json({ ok: true });
  res.cookies.set(sessionCookie(u.id));
  return res;
});
