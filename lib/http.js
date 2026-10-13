import { NextResponse } from 'next/server';

export function json(data, init = {}) {
  return NextResponse.json(data, init);
}

export function bad(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Wrap a route handler so thrown errors become clean JSON. */
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      return NextResponse.json({ error: e.message || 'server error', code: e.code || 'error' }, { status });
    }
  };
}

export async function body(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function qs(req) {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}
