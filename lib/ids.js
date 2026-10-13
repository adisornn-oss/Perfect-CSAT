import crypto from 'crypto';

const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Cryptographically random base62 string (NFR-01). */
export function token(len = 10) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[crypto.randomInt(ALPHA.length)];
  return s;
}

export const TOKEN_RE = /^[A-Za-z0-9]{8,32}$/;

export function uid(prefix = '') {
  return prefix + crypto.randomBytes(9).toString('base64url');
}

function secret() {
  return process.env.SESSION_SECRET || 'dev-only-secret-change-me';
}

export function hmac(data) {
  return crypto.createHmac('sha256', secret()).update(String(data)).digest('base64url');
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const h = crypto.scryptSync(String(pw), salt, 32).toString('base64url');
  return `${salt}:${h}`;
}

export function checkPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, h] = stored.split(':');
  return safeEqual(crypto.scryptSync(String(pw), salt, 32).toString('base64url'), h);
}

export function ipOf(req) {
  const h = req.headers;
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
}
