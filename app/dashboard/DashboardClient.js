'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, copyText, useToast } from '@/components/Shell';

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const SCORE_LABELS = ['แย่มาก', 'ไม่ค่อยดี', 'พอใช้', 'ดี', 'ดีมาก'];
const RES_LABEL = { yes: 'แก้ได้แล้ว', partial: 'บางส่วน', no: 'ยังไม่ได้', none: 'ไม่ได้ตอบ' };
const C_GOOD = '#2f5bea';
const C_LOW = '#e0795f';

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

function Meter({ value, target }) {
  if (value == null) return <div className="meter" />;
  const ok = target == null || value >= target;
  return (
    <div className="meter" title={target != null ? `เป้าหมาย ${target}%` : undefined}>
      <i style={{ width: `${Math.min(100, value)}%`, background: ok ? 'var(--good)' : 'var(--warn)' }} />
      {target != null && <b style={{ left: `calc(${Math.min(100, target)}% - 1px)` }} />}
    </div>
  );
}

function Tile({ k, v, s, children }) {
  return (
    <div className="card tile">
      <div className="k">{k}</div>
      <div className="v num">{v}</div>
      {s && <div className="s">{s}</div>}
      {children}
    </div>
  );
}

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
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#eceff5" />
            <text x={P.l - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#8a90a6">{t}%</text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(target)} y2={y(target)} stroke="#161a2c" strokeDasharray="4 4" strokeWidth="1" opacity="0.55" />
        <text x={W - P.r} y={y(target) - 5} fontSize="11" textAnchor="end" fill="#4a5068">เป้าหมาย {target}%</text>
        {data.map((d, i) => (
          <text key={d.month} x={x(i)} y={H - 10} fontSize="11" textAnchor="middle" fill="#8a90a6">
            {d.label.split(' ')[0]}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="#c9cede" />}
        <path d={path} fill="none" stroke={C_GOOD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) =>
          d.csat == null ? null : (
            <circle key={d.month} cx={x(i)} cy={y(d.csat)} r={hover === i ? 5 : 4} fill={C_GOOD} stroke="#fff" strokeWidth="2" />
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
          className="card small"
          style={{
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
          <div className="muted">ผู้ตอบ {h.n} · ลิงก์ {h.links}</div>
          <div className="muted">อัตราตอบกลับ {p1(h.responseRate)}</div>
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
          <div className="bar-row" key={n} title={`${n} ดาว: ${c} คำตอบ (${total ? ((c / total) * 100).toFixed(1) : 0}%)`}>
            <span>
              <span className="stars">★</span> {n} · {SCORE_LABELS[n - 1]}
            </span>
            <div className="bar">
              <i style={{ width: `${(c / max) * 100}%`, background: n >= 4 ? C_GOOD : C_LOW }} />
            </div>
            <span className="num r" style={{ textAlign: 'right' }}>
              {c} <span className="muted small">{total ? `${Math.round((c / total) * 100)}%` : ''}</span>
            </span>
          </div>
        );
      })}
      <div className="row small muted" style={{ marginTop: 10, gap: 14 }}>
        <span><span className="dot" style={{ color: C_GOOD }} /> พอใจ (4–5) นับใน CSAT</span>
        <span><span className="dot" style={{ color: C_LOW }} /> คะแนนต่ำ (1–3)</span>
      </div>
    </div>
  );
}

function BreakdownTable({ title, rows, s, showFlag }) {
  return (
    <div className="card">
      <div className="pad" style={{ paddingBottom: 6 }}>
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
                      <span className="badge amber" style={{ marginLeft: 6 }} title={`ผู้ตอบน้อยกว่า ${s.minAgentSample} คน — ไม่ควรใช้ประเมินผลงาน`}>
                        ตัวอย่างน้อย
                      </span>
                    )}
                  </td>
                  <td className="r num">
                    <b style={{ color: r.csat != null && r.csat < s.csatTarget ? 'var(--warn)' : undefined }}>{p1(r.csat)}</b>
                  </td>
                  <td className="r num">{r.n}</td>
                  <td className="r num">{r.low || <span className="muted">0</span>}</td>
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
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      {!rows.length ? (
        <div className="muted small">ยังไม่มีข้อมูล</div>
      ) : (
        rows.slice(0, 7).map((r, i) => (
          <div key={r.label} className="bar-row" style={{ gridTemplateColumns: '1fr 90px 34px' }}>
            <span>{i + 1}. {r.label}</span>
            <div className="bar"><i style={{ width: `${(r.n / max) * 100}%`, background: color }} /></div>
            <span className="num" style={{ textAlign: 'right' }}>{r.n}</span>
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

  if (err) return <div className="alert bad">{err}</div>;
  if (!d) return <div className="empty">กำลังโหลด…</div>;
  const s = d.settings;
  const k = d.kpi;

  const kpiText = d.kpiSheet
    .map(
      (m) =>
        `CSAT ${m.label}${product ? ` (${d.products.find((p) => p.code === product)?.name})` : ''}: ${p1(m.csat)} → กรอกชีต KPI: ${m.sheetValue ?? '–'} · ผู้ตอบ ${m.n} คน จาก ${m.links} ลิงก์ (อัตราตอบกลับ ${p1(m.responseRate)})${m.partial ? ' [เดือนยังไม่จบ]' : ''}${m.n < s.minSample ? ` [ตัวอย่างน้อยกว่า ${s.minSample}]` : ''}`,
    )
    .join('\n');

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="spread pagehead" style={{ marginBottom: 0 }}>
        <div>
          <h1>Dashboard CSAT</h1>
          <div className="small muted">
            {d.filters.from} ถึง {d.filters.to} · CSAT นับตามวันที่ลูกค้าตอบ · อัตราตอบกลับนับตามวันที่สร้างลิงก์ (เวลาไทย)
            {!isLead && ' · แสดงเฉพาะเคสของคุณ'}
          </div>
        </div>
        {isLead && (
          <div className="row">
            <a className="btn" href={`/api/export?${params}&format=csv`}>ส่งออก CSV</a>
            <a className="btn" href={`/api/export?${params}&format=xlsx`}>ส่งออก Excel</a>
          </div>
        )}
      </div>

      <div className="card pad filters">
        <label className="field">
          ช่วงเวลา
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="month">รายเดือน</option>
            <option value="range">กำหนดช่วงวันที่</option>
          </select>
        </label>
        {mode === 'month' ? (
          <label className="field">
            เดือน
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="field">ตั้งแต่<input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field">ถึง<input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </>
        )}
        <label className="field">
          ผลิตภัณฑ์
          <select className="input" value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {d.products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        {isLead && (
          <label className="field">
            ผู้ดูแล
            <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="">ทั้งทีม</option>
              {d.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        <label className="field">
          ช่องทาง
          <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {d.channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>

      {k.smallSample && (
        <div className="alert warn">
          ⚠️ ตัวอย่างน้อย: มีผู้ตอบ {k.responses} คน (น้อยกว่า {s.minSample} คน) ค่า CSAT ในช่วงนี้อาจคลาดเคลื่อนสูง ควรใช้ประกอบการพิจารณาอย่างระมัดระวัง
        </div>
      )}

      <div className="tiles">
        <Tile k="CSAT" v={p1(k.csat)} s={`เป้าหมาย ${s.csatTarget}% · ${k.csat == null ? 'ยังไม่มีคำตอบ' : k.csat >= s.csatTarget ? '✓ ถึงเป้า' : `ขาดอีก ${(s.csatTarget - k.csat).toFixed(1)} จุด`}`}>
          <Meter value={k.csat} target={s.csatTarget} />
        </Tile>
        <Tile k="จำนวนผู้ตอบ" v={k.responses} s={`พอใจ (4–5) ${k.satisfied} คน · ต่ำ (1–3) ${k.responses - k.satisfied} คน`} />
        <Tile k="อัตราตอบกลับ" v={p1(k.responseRate)} s={`ตอบ ${k.answered} จาก ${k.links} ลิงก์ · เป้า ${s.responseRateTarget}%`}>
          <Meter value={k.responseRate} target={s.responseRateTarget} />
        </Tile>
        <Tile
          k="คะแนนต่ำที่ติดต่อกลับใน 1 วันทำการ"
          v={p1(d.followup.onTimeRate)}
          s={`${d.followup.onTime} จาก ${d.followup.low} เคส${d.followup.overdue ? ` · เลยกำหนด ${d.followup.overdue}` : ''}`}
        >
          {d.followup.pending > 0 && (
            <a className="small" href="/followups">รอติดตาม {d.followup.pending} เคส →</a>
          )}
        </Tile>
        {d.sendRate ? (
          <Tile k="สัดส่วนเคสที่ส่งลิงก์" v={p1(d.sendRate.rate)} s={`ส่ง ${d.sendRate.links} จากเคสปิด ${d.sendRate.closed} · เป้า ${s.sendRateTarget}%`}>
            <Meter value={Math.min(100, d.sendRate.rate)} target={s.sendRateTarget} />
          </Tile>
        ) : (
          <Tile k="ลิงก์ที่สร้างในช่วงนี้" v={k.links} s={`เปิดดู ${d.status.opened} · ตอบ ${d.status.answered} · หมดอายุ ${d.status.expired} · รอ ${d.status.created}`} />
        )}
      </div>

      <div className="grid3">
        <div className="card pad">
          <div className="spread"><h2>แนวโน้ม CSAT รายเดือน</h2><span className="small muted">12 เดือนล่าสุด</span></div>
          <Trend data={d.trend} target={s.csatTarget} />
        </div>
        <div className="card pad">
          <h2 style={{ marginBottom: 8 }}>การกระจายคะแนน</h2>
          <Distribution dist={d.dist} />
          <h3 style={{ margin: '16px 0 6px' }}>ปัญหาได้รับการแก้ไขหรือยัง</h3>
          <div className="row small">
            {Object.entries(d.resolved).filter(([, n]) => n).map(([key, n]) => (
              <span key={key} className={`badge ${key === 'yes' ? 'green' : key === 'no' ? 'red' : key === 'partial' ? 'amber' : ''}`}>{RES_LABEL[key]} {n}</span>
            ))}
            {!k.responses && <span className="muted">–</span>}
          </div>
        </div>
      </div>

      <div className="card pad">
        <div className="spread">
          <div>
            <h2>สรุปสำหรับกรอกชีต KPI (ช่อง "ผลจริง")</h2>
            <div className="small muted">ปัดทศนิยม 1 ตำแหน่ง · ค่ากรอกชีตปัดเป็นจำนวนเต็ม</div>
          </div>
          <button className="btn" onClick={async () => (await copyText(kpiText)) && say('คัดลอกสรุปแล้ว')}>คัดลอกสรุป</button>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 12 }}>
          {d.kpiSheet.map((m) => (
            <div key={m.month} className="card pad" style={{ boxShadow: 'none', minWidth: 210 }}>
              <div className="small muted">{m.label}{m.partial ? ' (ยังไม่จบเดือน)' : ''}</div>
              <div className="row" style={{ alignItems: 'baseline' }}>
                <span style={{ fontSize: 34, fontWeight: 700 }} className="num">{m.sheetValue ?? '–'}</span>
                <span className="muted">({p1(m.csat)})</span>
                <button className="btn sm" onClick={async () => m.sheetValue != null && (await copyText(String(m.sheetValue))) && say(`คัดลอก ${m.sheetValue}`)}>คัดลอกตัวเลข</button>
              </div>
              <div className="small muted">ผู้ตอบ {m.n} · ลิงก์ {m.links} · ตอบกลับ {p1(m.responseRate)}</div>
              {m.n < s.minSample && <div className="small" style={{ color: 'var(--warn)' }}>ตัวอย่างน้อยกว่า {s.minSample}</div>}
            </div>
          ))}
        </div>
      </div>

      <BreakdownTable title={isLead ? 'CSAT รายผู้ดูแล' : 'CSAT ของฉัน'} rows={d.byAgent} s={s} showFlag />
      {isLead && (
        <p className="small muted" style={{ margin: '-6px 4px 0' }}>
          ผู้ดูแลที่มีผู้ตอบน้อยกว่า {s.minAgentSample} คน จะมีป้าย "ตัวอย่างน้อย" — ไม่ควรใช้ตัวเลขนั้นประเมินผลงานรายบุคคล (ปรับเกณฑ์ได้ที่หน้าตั้งค่า)
        </p>
      )}
      <div className="grid2">
        <BreakdownTable title="แยกตามผลิตภัณฑ์" rows={d.byProduct} s={s} />
        <BreakdownTable title="แยกตามช่องทาง" rows={d.byChannel} s={s} />
      </div>

      <div className="grid2">
        <div className="card pad stack">
          <Reasons title="สิ่งที่ควรปรับปรุง (จากคะแนน 1–3)" rows={d.improve} color={C_LOW} />
          <Reasons title="สิ่งที่ลูกค้าประทับใจ (จากคะแนน 4–5)" rows={d.impress} color={C_GOOD} />
        </div>
        <div className="card pad">
          <h2 style={{ marginBottom: 8 }}>ความเห็นล่าสุด</h2>
          {!d.comments.length ? (
            <div className="muted small">ยังไม่มีความเห็น</div>
          ) : (
            <div className="stack" style={{ gap: 10, maxHeight: 420, overflow: 'auto' }}>
              {d.comments.map((c) => (
                <div key={c.caseNo} className="note" style={{ borderColor: c.score >= 4 ? C_GOOD : C_LOW }}>
                  <div>“{c.comment}”</div>
                  <div className="muted small">
                    <span className="stars">{'★'.repeat(c.score)}</span> · <span className="mono">{c.caseNo}</span> · {c.agent} · {fmt(c.at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {toast}
    </div>
  );
}
