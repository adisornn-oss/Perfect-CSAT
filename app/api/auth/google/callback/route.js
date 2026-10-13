import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/notify';
import { hmac, safeEqual } from '@/lib/ids';
import { ensureSeed, getUserByEmail, audit, autoProvision, touchLogin } from '@/lib/data';
import { sessionCookie } from '@/lib/auth';

export async function GET(req) {
  const url = new URL(req.url);
  const fail = (e) => NextResponse.redirect(new URL(`/login?e=${e}`, appUrl(req)));
  const [state, sig] = (req.cookies.get('pcsat_oauth')?.value || '').split('.');
  if (!state || !safeEqual(sig, hmac(state)) || url.searchParams.get('state') !== state) return fail('state');
  const code = url.searchParams.get('code');
  if (!code) return fail('google');
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${appUrl(req)}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tr.ok) return fail('google');
  const { id_token: idt } = await tr.json();
  const claims = JSON.parse(Buffer.from(String(idt).split('.')[1] || '', 'base64url').toString('utf8') || '{}');
  if (!claims.email_verified) return fail('google');
  await ensureSeed();
  let u = await getUserByEmail(claims.email);
  if (!u) u = await autoProvision(claims); // same-domain staff join automatically
  if (!u || u.active === false) return fail(u ? 'disabled' : 'nouser');
  await touchLogin(u, claims);
  await audit(u, 'auth.login', { via: 'google' });
  const res = NextResponse.redirect(new URL('/cases', appUrl(req)));
  res.cookies.set(sessionCookie(u.id));
  res.cookies.set({ name: 'pcsat_oauth', value: '', path: '/', maxAge: 0 });
  return res;
}
