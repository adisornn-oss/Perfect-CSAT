// Google Workspace SSO (NFR-02). Enabled when GOOGLE_CLIENT_ID/SECRET are set.
import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/notify';
import { hmac, token } from '@/lib/ids';

export async function GET(req) {
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.redirect(new URL('/login?e=google', req.url));
  const state = token(16);
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${appUrl(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });
  if (process.env.GOOGLE_HD) p.set('hd', process.env.GOOGLE_HD);
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
  res.cookies.set({ name: 'pcsat_oauth', value: `${state}.${hmac(state)}`, httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 600 });
  return res;
}
