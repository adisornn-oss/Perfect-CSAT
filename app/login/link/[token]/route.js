// Passwordless sign-in: one-click link from an admin invite or an emailed magic link.
import { NextResponse } from 'next/server';
import { consumeLoginToken, touchLogin, audit } from '@/lib/data';
import { sessionCookie } from '@/lib/auth';
import { appUrl } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const u = await consumeLoginToken(params.token);
  if (!u) return NextResponse.redirect(new URL('/login?e=link', appUrl(req)));
  await touchLogin(u);
  await audit(u, 'auth.login', { via: 'link' });
  const res = NextResponse.redirect(new URL(u.role === 'agent' ? '/cases' : '/dashboard', appUrl(req)));
  res.cookies.set(sessionCookie(u.id));
  return res;
}
