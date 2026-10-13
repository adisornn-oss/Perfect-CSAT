// All business dates are Thai time (UTC+7, no DST).
const OFFSET = 7 * 3600 * 1000;
export const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const pad = (n) => String(n).padStart(2, '0');

/** Date shifted so its UTC getters read Thai wall-clock time. */
function th(d = new Date()) {
  return new Date(new Date(d).getTime() + OFFSET);
}

/** "2610" for Oct 2026 — used in case numbers. */
export function yymm(d = new Date()) {
  const t = th(d);
  return String(t.getUTCFullYear()).slice(2) + pad(t.getUTCMonth() + 1);
}

/** "2026-10" */
export function ym(d = new Date()) {
  const t = th(d);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

/** "2026-10-13" */
export function ymd(d = new Date()) {
  const t = th(d);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** "13 ต.ค. 2026 14:05" */
export function fmt(d, withTime = true) {
  if (!d) return '';
  const t = th(d);
  const s = `${t.getUTCDate()} ${TH_MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
  return withTime ? `${s} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` : s;
}

/** "2026-10" → "ต.ค. 2026" */
export function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  return `${TH_MONTHS[mo - 1]} ${y}`;
}

/** Inclusive list of "YYYY-MM" between two months. */
export function monthsBetween(a, b) {
  const out = [];
  let [y, m] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push(`${y}-${pad(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 120) break;
  }
  return out;
}

export function shiftMonth(m, delta) {
  let [y, mo] = m.split('-').map(Number);
  mo += delta;
  while (mo < 1) {
    mo += 12;
    y -= 1;
  }
  while (mo > 12) {
    mo -= 12;
    y += 1;
  }
  return `${y}-${pad(mo)}`;
}

export function lastDayOfMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return `${m}-${pad(new Date(Date.UTC(y, mo, 0)).getUTCDate())}`;
}

/** "2026-10" → "2610" */
export const ymToYymm = (m) => m.slice(2, 4) + m.slice(5, 7);

function isBusinessDay(dateStr, holidays) {
  const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return dow !== 0 && dow !== 6 && !holidays.includes(dateStr);
}

/**
 * Deadline for "within 1 business day": end of the first business day after
 * the day the event happened (Thai time). Returns epoch ms.
 */
export function businessDeadline(d, days = 1, holidays = []) {
  let cur = ymd(d);
  let left = days;
  while (left > 0) {
    const n = new Date(cur + 'T00:00:00Z');
    n.setUTCDate(n.getUTCDate() + 1);
    cur = n.toISOString().slice(0, 10);
    if (isBusinessDay(cur, holidays)) left -= 1;
  }
  // 23:59:59 Thai of `cur`
  return new Date(cur + 'T23:59:59+07:00').getTime();
}
