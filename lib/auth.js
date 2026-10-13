import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hmac, safeEqual } from './ids.js';
import { getUser } from './data.js';

const COOKIE = 'pcsat_session';
const MAX_AGE = 60 * 60 * 24 * 14;

export const ROLE_RANK = { agent: 1, lead: 2, admin: 3 };
export const ROLE_LABEL = { agent: 'CS Agent', lead: 'CS Lead', admin: 'Admin' };

export function sessionCookie(uid) {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return {
    name: COOKIE,
    value: `${body}.${hmac(body)}`,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  };
}

export const clearCookie = () => ({ name: COOKIE, value: '', path: '/', maxAge: 0 });

function readSession(raw) {
  if (!raw || !raw.includes('.')) return null;
  const [body, sig] = raw.split('.');
  if (!safeEqual(sig, hmac(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp && Date.now() > p.exp ? null : p;
  } catch {
    return null;
  }
}

export async function currentUser() {
  const s = readSession(cookies().get(COOKIE)?.value);
  if (!s?.uid) return null;
  const u = await getUser(s.uid);
  return u && u.active !== false ? u : null;
}

export const atLeast = (u, role) => (ROLE_RANK[u?.role] || 0) >= ROLE_RANK[role];

/** For route handlers: throws 401/403 JSON-able errors. */
export async function requireRole(role = 'agent') {
  const u = await currentUser();
  if (!u) throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), { status: 401 });
  if (!atLeast(u, role)) throw Object.assign(new Error('ไม่มีสิทธิ์เข้าถึง'), { status: 403 });
  return u;
}

/** For server pages: redirects instead of throwing. */
export async function pageUser(role = 'agent') {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (!atLeast(u, role)) redirect('/cases');
  return u;
}

export function publicUser(u) {
  if (!u) return null;
  const { passHash, ...rest } = u;
  return rest;
}
