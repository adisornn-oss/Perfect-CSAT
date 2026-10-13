'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, copyText, useToast } from '@/components/Shell';

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const SCORE_LABELS = ['แย่มาก', 'ไม่ค่อยดี', 'พอใช้', 'ดี', 'ดีมาก'];
const RES_LABEL = { yes: 'แก้ได้แล้ว', partial: 'บางส่วน', no: 'ยังไม่ได้', none: 'ไม่ได้ตอบ' };
const C_GOOD = '#4677d8';
const C_LOW = '#d9764a';

function thisMonth() {
  const d = new Date(Date.now() + 7 * 3600e3);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthOptions(n = 18) {
  const out = [];
  let [y, m] = thisMonth().split('-').map(Number);
  for (let i = 0; i < n; i++) {
    out.push({ v: `${y}-${String(m).padStart(2, '0')}`, l: `${TH_M[m - 1]} ${y}` });
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}
const p1 = (x) => (x == null ? '–' : `${x.toFixed(1)}%`);
const fmt = (iso) =>
  new Date(iso).toLocaleString('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Track({ value, target }) {
  if (value == null) return <div className="track" />;
  return (
    <div className="track" title={target != null ? `เป้าหมาย ${target}%` : undefined}>
      <i style={{ width: `${Math.min(100, value)}%`, background: target == null || value >= target ? 'var(--good)' : 'var(--ink)' }} />
      {target != null && <b style={{ left: `calc(${Math.min(100, target)}% - 1px)` }} />}
    </div>
  );
}

function Stat({ k, v, unit, s, children }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {unit && v !== '—' && <small>{unit}</small>}
      </div>
      {s && <div className="s">{s}</div>}
      {children}
    </div>
  );
}
const n1 = (x) => (x == null ? '—' : x.toFixed(1));

/* --------- trend: single-series line + dashed target, hover tooltip --------- */
function Trend({ data, target }) {
  const [hover, setHover] = useState(null);
  const W = 640;
  const H = 230;
  const P = { l: 40, r: 14, t: 14, b: 30 };
  const vals = data.filter((d) => d.csat != null).map((d) => d.csat);
  const lo = Math.max(0, Math.floor((Math.min(target, ...(vals.length ? vals : [target])) - 10) / 10) * 10);
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v) => P.t + ((100 - v) * (H - P.t - P.b)) / (100 - lo || 1);
  const ticks = [];
  for (let t = lo; t <= 100; t += lo >= 60 ? 10 : 20) ticks.push(t);
  let path = '';
  data.forEach((d, i) => {
    if (d.csat == null) return;
    const prev = data[i - 1];
    path += `${prev && prev.csat != null ? 'L' : 'M'}${x(i)},${y(d.csat)} `;
  });
  const h = hover != null ? data[hover] : null;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="แนวโน้ม CSAT รายเดือน" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#f1efec" />
            <text x={P.l - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#a19b95">{t}%</text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(target)} y2={y(target)} stroke="#d6246e" strokeDasharray="3 4" strokeWidth="1.2" />
        <text x={W - P.r} y={y(target) - 6} fontSize="11" textAnchor="end" fill="#d6246e">เป้า {target}%</text>
        {data.map((d, i) => (
          <text key={d.month} x={x(i)} y={H - 10} fontSize="11" textAnchor="middle" fill="#a19b95">
            {d.label.split(' ')[0]}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="#dcd8d3" />}
        <path d={path} fill="none" stroke="#1c1917" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) =>
          d.csat == null ? null : (
            <circle key={d.month} cx={x(i)} cy={y(d.csat)} r={hover === i ? 5 : 3.5} fill="#1c1917" stroke="#fff" strokeWidth="2" />
          ),
        )}
        {data.map((d, i) => (
          <rect
            key={d.month}
            x={x(i) - (W - P.l - P.r) / data.length / 2}
            y={P.t}
            width={(W - P.l - P.r) / data.length}
            height={H - P.t - P.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {h && (
        <div
          className="panel small"
          style={{
            boxShadow: '0 6px 18px rgba(28,25,23,.1)',
            position: 'absolute',
            top: 6,
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > data.length / 2 ? '-105%' : '5%'})`,
            padding: '8px 10px',
            pointerEvents: 'none',
            minWidth: 150,
          }}
        >
          <b>{h.label}</b>
          <div>CSAT <b className="num">{p1(h.csat)}</b></div>
          <div className="soft">ผู้ตอบ {h.n} · ลิงก์ {h.links}</div>
          <div className="soft">อัตราตอบกลับ {p1(h.responseRate)}</div>
        </div>
      )}
    </div>
  );
}

function Distribution({ dist }) {
  const total = dist.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...dist);
  return (
    <div>
      {[5, 4, 3, 2, 1].map((n) => {
        const c = dist[n - 1];
        return (
          <div className="hbar" key={n} title={`${n} ดาว: ${c} คำตอบ (${total ? ((c / total) * 100).toFixed(1) : 0}%)`}>
            <span>
              <b className="num">{n}</b> <span className="soft">{SCORE_LABELS[n - 1]}</span>
            </span>
            <div className="bar">
              <i style={{ width: `${(c / max) * 100}%`, background: n >= 4 ? C_GOOD : C_LOW }} />
            </div>
            <span className="n">
              {c} <span className="muted xs">{total ? `${Math.round((c / total) * 100)}%` : ''}</span>
            </span>
          </div>
        );
      })}
      <div className="row xs muted" style={{ marginTop: 10, gap: 14 }}>
        <span style={{ color: C_GOOD }}>■ <span className="muted">4–5 นับเป็นพอใจ</span></span>
        <span style={{ color: C_LOW }}>■ <span className="muted">1–3 คะแนนต่ำ</span></span>
      </div>
    </div>
  );
}

function BreakdownTable({ title, rows, s, showFlag }) {
  return (
    <div className="panel">
      <div className="panel-h">
        <h2>{title}</h2>
      </div>
      <div className="tablewrap">
        {!rows.length ? (
          <div className="empty">ไม่มีข้อมูล</div>
        ) : (
          <table className="t">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th className="r">CSAT</th>
                <th className="r">ผู้ตอบ</th>
                <th className="r">คะแนนต่ำ</th>
                <th className="r">ลิงก์ที่ส่ง</th>
                <th className="r">อัตราตอบกลับ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.label}
                    {showFlag && r.smallSample && (
                      <span className="tag warn" style={{ marginLeft: 6 }} title={`ผู้ตอบน้อยกว่า ${s.minAgentSample} คน — ไม่ควรใช้ประเมินผลงาน`}>
                        ตัวอย่างน้อย
                      </span>
                    )}
                  </td>
                  <td className="r num">
                    <b style={{ fontWeight: 500, color: r.csat != null && r.csat < s.csatTarget ? 'var(--warn)' : undefined }}>{p1(r.csat)}</b>
                  </td>
                  <td className="r num">{r.n}</td>
                  <td className="r num">{r.low || <span className="muted">—</span>}</td>
                  <td className="r num">{r.links}</td>
                  <td className="r num">{p1(r.responseRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Reasons({ title, rows, color }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      {!rows.length ? (
        <div className="muted small">ยังไม่มีคำตอบ</div>
      ) : (
        rows.slice(0, 7).map((r, i) => (
          <div key={r.label} className="hbar" style={{ gridTemplateColumns: '1fr 90px 30px' }}>
            <span>{r.label}</span>
            <div className="bar"><i style={{ width: `${(r.n / max) * 100}%`, background: color }} /></div>
            <span className="n">{r.n}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default function DashboardClient({ user }) {
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(thisMonth());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [product, setProduct] = useState('');
  const [agent, setAgent] = useState('');
  const [channel, setChannel] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [toast, say] = useToast();
  const months = useMemo(() => monthOptions(), []);
  const isLead = user.role !== 'agent';

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (mode === 'month') p.set('month', month);
    else {
      if (from) p.set('from', from);
      if (to) p.set('to', to);
    }
    if (product) p.set('product', product);
    if (agent) p.set('agent', agent);
    if (channel) p.set('channel', channel);
    return p.toString();
  }, [mode, month, from, to, product, agent, channel]);

  useEffect(() => {
    let alive = true;
    setErr('');
    api(`/api/stats?${params}`)
      .then((j) => alive && setD(j))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [params]);

  if (err) return <div className="note-line bad">{err}</div>;
  if (!d) return <div className="empty">กำลังโหลด…</div>;
  const s = d.settings;
  const k = d.kpi;
  const pLabel = product ? ` (${product.startsWith('brand:') ? product.slice(6) : d.products.find((p) => p.code === product)?.name})` : '';
  const kpiText = d.kpiSheet
    .map(
      (m) =>
        `CSAT ${m.label}${pLabel}: ${p1(m.csat)} → กรอกชีต KPI ${m.sheetValue ?? '–'} · ผู้ตอบ ${m.n} จาก ${m.links} ลิงก์ (ตอบกลับ ${p1(m.responseRate)})${m.partial ? ' · เดือนยังไม่จบ' : ''}${m.n < s.minSample ? ` · ตัวอย่างน้อยกว่า ${s.minSample}` : ''}`,
    )
    .join('\n');
  const gap = k.csat == null ? null : k.csat - s.csatTarget;

  return (
    <div>
      <div className="pagehead">
        <div>
          <h1>ภาพรวม CSAT</h1>
          <div className="sub">{isLead ? 'ทุกผลิตภัณฑ์ ทั้งทีม' : 'เฉพาะเคสของคุณ'} · เวลาไทย</div>
        </div>
        {isLead && (
          <div className="row">
            <a className="btn" href={`/api/export?${params}&format=csv`}>CSV</a>
            <a className="btn" href={`/api/export?${params}&format=xlsx`}>ส่งออก Excel</a>
          </div>
        )}
      </div>

      <div className="filters">
        <div className="seg">
          <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>รายเดือน</button>
          <button className={mode === 'range' ? 'on' : ''} onClick={() => setMode('range')}>ช่วงวันที่</button>
        </div>
        {mode === 'month' ? (
          <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        ) : (
          <>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="ตั้งแต่" />
            <span className="muted">–</span>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="ถึง" />
          </>
        )}
        <select className="input" value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="">ทุกผลิตภัณฑ์</option>
          {[...new Set(d.products.map((p) => p.brand))].map((b) => {
            const items = d.products.filter((p) => p.brand === b);
            if (items.length === 1) return <option key={b} value={items[0].code}>{items[0].name}</option>;
            return (
              <optgroup key={b} label={b}>
                <option value={`brand:${b}`}>{b} ทั้งหมด</option>
                {items.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </optgroup>
            );
          })}
        </select>
        {isLead && (
          <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">ทุกคนในทีม</option>
            {d.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">ทุกช่องทาง</option>
          {d.channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      {k.smallSample && (
        <div className="note-line warn" style={{ marginBottom: 14 }}>
          มีผู้ตอบ {k.responses} คน ยังไม่ถึง {s.minSample} คน ตัวเลขช่วงนี้แกว่งได้มาก ใช้ประกอบการตัดสินใจอย่างระวัง
        </div>
      )}

      <div className="stats">
        <Stat k="CSAT" v={n1(k.csat)} unit="%" s={gap == null ? 'ยังไม่มีคำตอบ' : gap >= 0 ? <>ถึงเป้า <b>{s.csatTarget}%</b></> : <>ต่ำกว่าเป้า <b>{Math.abs(gap).toFixed(1)}</b> จุด</>}>
          <Track value={k.csat} target={s.csatTarget} />
        </Stat>
        <Stat k="ผู้ตอบ" v={k.responses} s={<>พอใจ <b>{k.satisfied}</b> · ต่ำ <b>{k.responses - k.satisfied}</b></>} />
        <Stat k="อัตราตอบกลับ" v={n1(k.responseRate)} unit="%" s={<>{k.answered} จาก {k.links} ลิงก์ · เป้า {s.responseRateTarget}%</>}>
          <Track value={k.responseRate} target={s.responseRateTarget} />
        </Stat>
        <Stat k="คะแนนต่ำที่โทรกลับทัน" v={n1(d.followup.onTimeRate)} unit="%" s={d.followup.low ? <>{d.followup.onTime} จาก {d.followup.low} เคส ภายใน 1 วันทำการ</> : 'ไม่มีคะแนนต่ำ'}>
          {d.followup.pending > 0 && <a className="link xs" href="/followups">รอติดตาม {d.followup.pending} เคส{d.followup.overdue ? ` (เลยกำหนด ${d.followup.overdue})` : ''}</a>}
        </Stat>
        {d.sendRate ? (
          <Stat k="ส่งลิงก์ครบทุกเคส" v={n1(d.sendRate.rate)} unit="%" s={<>{d.sendRate.links} จากเคสปิด {d.sendRate.closed}</>}>
            <Track value={Math.min(100, d.sendRate.rate)} target={s.sendRateTarget} />
          </Stat>
        ) : (
          <Stat k="ลิงก์ที่ส่ง" v={k.links} s={<>เปิดดู {d.status.opened} · หมดอายุ {d.status.expired}</>} />
        )}
      </div>

      <div className="cols-21 section" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel-h"><h2>CSAT รายเดือน</h2><span className="xs muted">12 เดือนล่าสุด</span></div>
          <div className="panel-b"><Trend data={d.trend} target={s.csatTarget} /></div>
        </div>
        <div className="panel">
          <div className="panel-h"><h2>คะแนนที่ได้</h2></div>
          <div className="panel-b">
            <Distribution dist={d.dist} />
            <div className="xs soft" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
              ปัญหาได้รับการแก้ไข:{' '}
              {k.responses
                ? Object.entries(d.resolved).filter(([, n]) => n).map(([key, n]) => `${RES_LABEL[key]} ${n}`).join(' · ')
                : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="panel section" style={{ marginTop: 16 }}>
        <div className="panel-h">
          <div>
            <h2>ตัวเลขสำหรับชีต KPI</h2>
            <div className="xs muted">ช่อง “ผลจริง” · ปัดเป็นจำนวนเต็ม</div>
          </div>
          <button className="btn sm" onClick={async () => (await copyText(kpiText)) && say('คัดลอกสรุปแล้ว')}>คัดลอกสรุปทั้งหมด</button>
        </div>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>เดือน</th><th className="r">กรอกชีต</th><th className="r">CSAT</th><th className="r">ผู้ตอบ</th><th className="r">ลิงก์</th><th className="r">ตอบกลับ</th><th /></tr></thead>
            <tbody>
              {d.kpiSheet.map((m) => (
                <tr key={m.month}>
                  <td>
                    {m.label}
                    {m.partial && <span className="xs muted"> · ยังไม่จบเดือน</span>}
                    {m.n < s.minSample && <span className="tag warn" style={{ marginLeft: 6 }}>ตัวอย่างน้อย</span>}
                  </td>
                  <td className="r num" style={{ fontSize: 18, fontWeight: 600 }}>{m.sheetValue ?? '—'}</td>
                  <td className="r num soft">{p1(m.csat)}</td>
                  <td className="r num">{m.n}</td>
                  <td className="r num">{m.links}</td>
                  <td className="r num">{p1(m.responseRate)}</td>
                  <td className="r"><button className="btn sm quiet" disabled={m.sheetValue == null} onClick={async () => (await copyText(String(m.sheetValue))) && say(`คัดลอก ${m.sheetValue}`)}>คัดลอก</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <BreakdownTable title={isLead ? 'รายคน' : 'ของฉัน'} rows={d.byAgent} s={s} showFlag />
        {isLead && <p className="xs muted" style={{ margin: '8px 2px 0' }}>คนที่มีผู้ตอบน้อยกว่า {s.minAgentSample} คนจะมีป้าย “ตัวอย่างน้อย” — ยังไม่ควรใช้ตัวเลขนี้ประเมินผลงาน</p>}
      </div>
      <div className="cols section" style={{ marginTop: 16 }}>
        <BreakdownTable title="แยกตามแบรนด์" rows={d.byBrand} s={s} />
        <BreakdownTable title="แยกตามผลิตภัณฑ์" rows={d.byProduct} s={s} />
      </div>
      <div className="section" style={{ marginTop: 16 }}>
        <BreakdownTable title="แยกตามช่องทาง" rows={d.byChannel} s={s} />
      </div>

      <div className="cols section" style={{ marginTop: 16 }}>
        <div className="panel panel-b stack" style={{ gap: 22 }}>
          <Reasons title="ลูกค้าอยากให้ปรับปรุง" rows={d.improve} color={C_LOW} />
          <Reasons title="ลูกค้าประทับใจ" rows={d.impress} color={C_GOOD} />
        </div>
        <div className="panel">
          <div className="panel-h"><h2>ความเห็นล่าสุด</h2></div>
          <div className="panel-b">
            {!d.comments.length ? (
              <div className="muted small">ยังไม่มีความเห็น</div>
            ) : (
              <div style={{ maxHeight: 420, overflow: 'auto' }}>
                {d.comments.map((c) => (
                  <div key={c.caseNo} className="log" style={{ borderColor: c.score >= 4 ? C_GOOD : C_LOW, marginBottom: 14 }}>
                    <div className="quote">{c.comment}</div>
                    <div className="xs muted" style={{ marginTop: 2 }}>
                      {c.score}/5 · <span className="mono">{c.caseNo}</span> · {c.agent} · {fmt(c.at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {toast}
    </div>
  );
}
