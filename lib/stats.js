// CSAT metrics exactly as defined in the requirements:
//   CSAT %          = responses scoring 4–5 ÷ all responses × 100   (month = response date, Thai time)
//   Response rate % = links answered ÷ links created × 100          (month = link creation date)
// Expired links without an answer are excluded from CSAT but counted in response rate.
import { loadBundles, getSettings, getProducts, listUsers, getClosedCounts, CHANNEL_LABEL } from './data.js';
import { ym, ymd, monthsBetween, shiftMonth, ymToYymm, lastDayOfMonth, monthLabel } from './time.js';

export const round1 = (x) => Math.round(x * 10) / 10;
const pct = (a, b) => (b ? round1((a / b) * 100) : null);

export function normalizeFilters(q, user) {
  const today = ymd();
  const month = /^\d{4}-\d{2}$/.test(q.month || '') ? q.month : null;
  let from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : null;
  let to = /^\d{4}-\d{2}-\d{2}$/.test(q.to || '') ? q.to : null;
  if (month) {
    from = `${month}-01`;
    to = lastDayOfMonth(month);
  }
  if (!from) from = `${today.slice(0, 7)}-01`;
  if (!to) to = today;
  if (from > to) [from, to] = [to, from];
  return {
    from,
    to,
    product: q.product || '',
    agent: user.role === 'agent' ? user.id : q.agent || '',
    channel: q.channel || '',
  };
}

// product filter accepts a product code ("TB") or a whole brand ("brand:Thunder Solution")
const matches = (f, c, brandOf) =>
  (!f.product || (f.product.startsWith('brand:') ? brandOf[c.product] === f.product.slice(6) : c.product === f.product)) &&
  (!f.agent || c.agentId === f.agent) &&
  (!f.channel || c.channel === f.channel);

/** Load bundles that can matter for [from,to] (+ trend window) and apply dimension filters. */
async function load(f, trendMonths = 0) {
  const settings = await getSettings();
  const toM = f.to.slice(0, 7);
  const fromM = f.from.slice(0, 7);
  const startM = trendMonths ? shiftMonth(toM, -(trendMonths - 1)) : fromM;
  const first = startM < fromM ? startM : fromM;
  // responses can land up to linkTtlDays after the link was created
  const back = Math.ceil(settings.linkTtlDays / 28) + 1;
  const months = monthsBetween(shiftMonth(first, -back), toM);
  const [all, products] = await Promise.all([loadBundles(months.map(ymToYymm)), getProducts(true)]);
  const brandOf = Object.fromEntries(products.map((p) => [p.code, p.brand || p.name]));
  return { settings, rows: all.filter((b) => matches(f, b.case, brandOf)) };
}

function summarize(rows, f) {
  const inRange = (iso) => {
    const d = ymd(iso);
    return d >= f.from && d <= f.to;
  };
  const resp = rows.filter((b) => b.resp && inRange(b.resp.answeredAt));
  const links = rows.filter((b) => inRange(b.case.createdAt));
  const sat = resp.filter((b) => b.resp.score >= 4).length;
  const answered = links.filter((b) => b.resp).length;
  return { resp, links, sat, answered, csat: pct(sat, resp.length), responseRate: pct(answered, links.length) };
}

export async function computeStats(q, user) {
  const f = normalizeFilters(q, user);
  const TREND = 12;
  const { settings, rows } = await load(f, TREND);
  const [products, users] = await Promise.all([getProducts(true), listUsers()]);
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  const s = summarize(rows, f);

  const dist = [0, 0, 0, 0, 0];
  s.resp.forEach((b) => (dist[b.resp.score - 1] += 1));

  const resolved = { yes: 0, partial: 0, no: 0, none: 0 };
  s.resp.forEach((b) => (resolved[b.resp.resolved || 'none'] += 1));

  const status = { created: 0, opened: 0, answered: 0, expired: 0 };
  s.links.forEach((b) => (status[b.status] += 1));

  // trend (monthly, ending at `to` month)
  const toM = f.to.slice(0, 7);
  const trend = monthsBetween(shiftMonth(toM, -(TREND - 1)), toM).map((m) => {
    const mf = { ...f, from: `${m}-01`, to: lastDayOfMonth(m) };
    const t = summarize(rows, mf);
    return { month: m, label: monthLabel(m), n: t.resp.length, csat: t.csat, links: t.links.length, responseRate: t.responseRate };
  });

  // breakdowns
  const group = (keyFn, labelFn) => {
    const map = new Map();
    const get = (k) => {
      if (!map.has(k)) map.set(k, { key: k, label: labelFn(k), n: 0, sat: 0, low: 0, links: 0, answered: 0 });
      return map.get(k);
    };
    s.resp.forEach((b) => {
      const g = get(keyFn(b.case));
      g.n += 1;
      if (b.resp.score >= 4) g.sat += 1;
      if (b.resp.score <= 3) g.low += 1;
    });
    s.links.forEach((b) => {
      const g = get(keyFn(b.case));
      g.links += 1;
      if (b.resp) g.answered += 1;
    });
    return [...map.values()]
      .map((g) => ({ ...g, csat: pct(g.sat, g.n), responseRate: pct(g.answered, g.links) }))
      .sort((a, b) => b.n - a.n || b.links - a.links);
  };
  const agentRows = rows.reduce((m, b) => ((m[b.case.agentId] = b.case.agentNick), m), {});
  const byAgent = group(
    (c) => c.agentId,
    (id) => (userById[id] ? userById[id].nickname || userById[id].name : agentRows[id] || id),
  ).map((g) => ({ ...g, smallSample: g.n < settings.minAgentSample }));
  const byProduct = group(
    (c) => c.product,
    (code) => products.find((p) => p.code === code)?.name || code,
  );
  const brandOf = Object.fromEntries(products.map((p) => [p.code, p.brand || p.name]));
  const byBrand = group(
    (c) => brandOf[c.product] || c.product,
    (b) => b,
  );
  const byChannel = group(
    (c) => c.channel,
    (ch) => CHANNEL_LABEL[ch] || ch,
  );

  // reasons + comments
  const countReasons = (list) => {
    const m = {};
    list.forEach((b) => (b.resp.reasons || []).forEach((r) => (m[r] = (m[r] || 0) + 1)));
    return Object.entries(m)
      .map(([label, n]) => ({ label, n }))
      .sort((a, b) => b.n - a.n);
  };
  const improve = countReasons(s.resp.filter((b) => b.resp.score <= 3));
  const impress = countReasons(s.resp.filter((b) => b.resp.score >= 4));
  const comments = s.resp
    .filter((b) => b.resp.comment)
    .sort((a, b) => (a.resp.answeredAt < b.resp.answeredAt ? 1 : -1))
    .slice(0, 30)
    .map((b) => ({
      caseNo: b.case.no,
      product: b.case.product,
      agent: b.case.agentNick,
      score: b.resp.score,
      comment: b.resp.comment,
      at: b.resp.answeredAt,
    }));

  // low-score follow-up KPI
  const low = s.resp.filter((b) => b.resp.score <= 3 && b.fu && b.fu.status !== 'cancelled');
  const onTime = low.filter((b) => b.fu.contactedAt && new Date(b.fu.contactedAt) <= new Date(b.fu.deadline)).length;
  const followup = {
    low: low.length,
    onTime,
    onTimeRate: pct(onTime, low.length),
    pending: low.filter((b) => b.fu.status === 'pending').length,
    overdue: low.filter((b) => b.fu.status === 'pending' && Date.now() > new Date(b.fu.deadline).getTime()).length,
  };

  // send ratio — only meaningful when the range is whole months with closed counts entered
  const months = monthsBetween(f.from.slice(0, 7), toM);
  const wholeMonths = f.from.endsWith('-01') && f.to === lastDayOfMonth(toM);
  let sendRate = null;
  if (wholeMonths && !f.agent && !f.channel) {
    const closed = await getClosedCounts(months);
    const codes = !f.product ? products.map((p) => p.code) : f.product.startsWith('brand:') ? products.filter((p) => (p.brand || p.name) === f.product.slice(6)).map((p) => p.code) : [f.product];
    let total = 0;
    let complete = true;
    months.forEach((m) =>
      codes.forEach((code) => {
        if (closed[m][code] == null) complete = false;
        else total += closed[m][code];
      }),
    );
    if (complete && total) sendRate = { closed: total, links: s.links.length, rate: pct(s.links.length, total) };
  }

  // KPI sheet lines (FR-407)
  const kpiSheet = months.map((m) => {
    const mf = { ...f, from: `${m}-01`, to: lastDayOfMonth(m) };
    const t = summarize(rows, mf);
    return {
      month: m,
      label: monthLabel(m),
      csat: t.csat,
      sheetValue: t.csat == null ? null : Math.round(t.csat),
      n: t.resp.length,
      links: t.links.length,
      responseRate: t.responseRate,
      partial: m === ymd().slice(0, 7),
    };
  });

  return {
    filters: f,
    agents: user.role === 'agent' ? [] : users.filter((u) => u.active !== false).map((u) => ({ id: u.id, name: u.nickname || u.name })),
    products: products.map((p) => ({ code: p.code, name: p.name, brand: p.brand || p.name, color: p.color })),
    channels: Object.entries(CHANNEL_LABEL).map(([id, label]) => ({ id, label })),
    settings: {
      csatTarget: settings.csatTarget,
      responseRateTarget: settings.responseRateTarget,
      sendRateTarget: settings.sendRateTarget,
      minSample: settings.minSample,
      minAgentSample: settings.minAgentSample,
    },
    kpi: {
      responses: s.resp.length,
      satisfied: s.sat,
      csat: s.csat,
      links: s.links.length,
      answered: s.answered,
      responseRate: s.responseRate,
      smallSample: s.resp.length < settings.minSample,
    },
    dist,
    resolved,
    status,
    trend,
    byAgent,
    byProduct,
    byBrand,
    byChannel,
    improve,
    impress,
    comments,
    followup,
    sendRate,
    kpiSheet,
  };
}

/** Case-level rows for export: cases created OR answered within the range. */
export async function exportRows(q, user) {
  const f = normalizeFilters(q, user);
  const { rows } = await load(f);
  const [products, users] = await Promise.all([getProducts(true), listUsers()]);
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  const inRange = (iso) => {
    if (!iso) return false;
    const d = ymd(iso);
    return d >= f.from && d <= f.to;
  };
  return {
    filters: f,
    rows: rows
      .filter((b) => inRange(b.case.createdAt) || (b.resp && inRange(b.resp.answeredAt)))
      .map((b) => ({ ...b, productName: products.find((p) => p.code === b.case.product)?.name || b.case.product, assignee: userById[b.fu?.assigneeId] })),
  };
}

export { ym };
