import { incr, get } from './store.js';

const keyOf = (bucket, id, windowSec) => `rl:${bucket}:${id}:${Math.floor(Date.now() / 1000 / windowSec)}`;

/** Fixed-window limiter. Counts this hit; returns true when the caller is over the limit. */
export async function limited(bucket, id, max, windowSec) {
  return (await incr(keyOf(bucket, id, windowSec), windowSec + 5)) > max;
}

/** Check a bucket without counting a hit. */
export async function over(bucket, id, max, windowSec) {
  return (Number(await get(keyOf(bucket, id, windowSec))) || 0) >= max;
}
