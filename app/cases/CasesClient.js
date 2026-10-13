'use client';
import { useEffect, useRef, useState } from 'react';
import { api, copyText, useToast } from '@/components/Shell';

const STATUS = {
  created: ['สร้างแล้ว', ''],
  opened: ['เปิดดูแล้ว', 'blue'],
  answered: ['ตอบแล้ว', 'green'],
  expired: ['หมดอายุ', 'amber'],
};
const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function Stars({ n }) {
  if (!n) return <span className="muted">–</span>;
  return (
    <span className="stars" title={`${n}/5`}>
      {'★'.repeat(n)}
      <span style={{ color: '#d6dae5' }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

function QrModal({ c, onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal card pad-lg" style={{ maxWidth: 360, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <h2>QR แบบประเมิน</h2>
        <div className="mono muted small" style={{ margin: '4px 0 12px' }}>{c.no}</div>
        <img src={`/api/cases/${c.no}/qr`} alt="QR code" width={260} height={260} style={{ display: 'block', margin: '0 auto' }} />
        <p className="small muted">ให้ลูกค้าสแกนเพื่อเปิดแบบประเมิน</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a className="btn" href={`/api/cases/${c.no}/qr`} download={`${c.no}.svg`}>ดาวน์โหลด</a>
          <button className="btn primary" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

export default function CasesClient({ user }) {
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [product, setProduct] = useState('');
  const [channel, setChannel] = useState('');
  const [extRef, setExtRef] = useState('');
  const [parentCase, setParentCase] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('mine');
  const [statusF, setStatusF] = useState('');
  const [qr, setQr] = useState(null);
  const [toast, say] = useToast();
  const refInput = useRef(null);

  async function load(opts = {}) {
    const p = new URLSearchParams({ q: opts.q ?? q, scope: opts.scope ?? scope, status: opts.status ?? statusF });
    const j = await api(`/api/cases?${p}`);
    setList(j.cases);
    if (!products.length) {
      setProducts(j.products);
      setChannels(j.channels);
      const last = JSON.parse(localStorage.getItem('pcsat:last') || '{}');
      setProduct(j.products.some((x) => x.code === last.product) ? last.product : j.products[0]?.code || '');
      setChannel(j.channels.some((x) => x.id === last.channel) ? last.channel : 'line');
    }
  }
  useEffect(() => {
    load().catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e) {
    e?.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const j = await api('/api/cases', { method: 'POST', body: { product, channel, extRef, parentCase: parentCase?.no } });
      localStorage.setItem('pcsat:last', JSON.stringify({ product, channel }));
      setResult(j);
      setExtRef('');
      setParentCase(null);
      if (await copyText(j.message)) say('สร้างเคสแล้ว · คัดลอกข้อความให้แล้ว วางส่งลูกค้าได้เลย');
      load().catch(() => {});
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyFor(c) {
    const j = await api(`/api/cases/${c.no}`);
    if (await copyText(j.message)) say(`คัดลอกข้อความของ ${c.no} แล้ว`);
  }

  function reopen(c) {
    setParentCase(c);
    setProduct(c.product);
    setChannel(c.channel);
    setExtRef(c.extRef || '');
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => refInput.current?.focus(), 300);
  }

  const pName = (code) => products.find((p) => p.code === code)?.name || code;
  const chName = (id) => channels.find((c) => c.id === id)?.label || id;
  const pColor = products.find((p) => p.code === product)?.color;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <form className="card pad-lg stack" onSubmit={create}>
          <div className="spread">
            <h1>สร้างลิงก์ประเมิน</h1>
            <span className="small muted">ผู้ดูแล: <b style={{ color: 'var(--ink)' }}>{user.nickname || user.name}</b></span>
          </div>
          {parentCase && (
            <div className="alert info row" style={{ justifyContent: 'space-between' }}>
              <span>เปิดเคสใหม่ต่อจาก <b className="mono">{parentCase.no}</b></span>
              <button type="button" className="btn sm" onClick={() => setParentCase(null)}>ยกเลิก</button>
            </div>
          )}
          <div className="field">
            <span className="small" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>ผลิตภัณฑ์</span>
            <div className="seg">
              {products.map((p) => (
                <button
                  type="button"
                  key={p.code}
                  className={product === p.code ? 'on' : ''}
                  style={product === p.code ? { background: p.color, borderColor: p.color } : undefined}
                  onClick={() => setProduct(p.code)}
                  disabled={Boolean(parentCase)}
                >
                  {p.name} <span className="mono small" style={{ opacity: 0.7 }}>{p.code}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="small" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>ช่องทางที่ส่งลิงก์</span>
            <div className="seg">
              {channels.map((c) => (
                <button type="button" key={c.id} className={channel === c.id ? 'on' : ''} onClick={() => setChannel(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            เลขอ้างอิงจากระบบอื่น (ไม่บังคับ) เช่น ID แชต LINE OA
            <input ref={refInput} className="input" value={extRef} onChange={(e) => setExtRef(e.target.value)} maxLength={120} placeholder="เช่น U1a2b3c… หรือ #12345" />
          </label>
          {err && <div className="alert bad">{err}</div>}
          <button className="btn primary lg block" disabled={busy || !product || !channel} style={pColor ? { background: pColor, borderColor: pColor } : undefined}>
            {busy ? 'กำลังสร้าง…' : 'สร้างเคส + ลิงก์ และคัดลอกข้อความ'}
          </button>
        </form>

        <div className="card pad-lg stack">
          {result ? (
            <>
              <div className="spread">
                <div>
                  <div className="small muted">เลขเคส</div>
                  <div className="casebig mono">{result.case.no}</div>
                </div>
                <span className="badge">{pName(result.case.product)} · {chName(result.case.channel)}</span>
              </div>
              <div className="copybox">{result.message}</div>
              <div className="row">
                <button className="btn primary" onClick={async () => (await copyText(result.message)) && say('คัดลอกข้อความแล้ว')}>คัดลอกข้อความ</button>
                <button className="btn" onClick={async () => (await copyText(result.case.link)) && say('คัดลอกลิงก์แล้ว')}>คัดลอกเฉพาะลิงก์</button>
                <button className="btn" onClick={() => setQr(result.case)}>QR code</button>
              </div>
              <div className="small muted">ลิงก์ใช้ได้ถึง {fmt(result.case.expiresAt)} หรือจนกว่าลูกค้าจะตอบ · 1 เคส = 1 ลิงก์</div>
            </>
          ) : (
            <div className="empty">
              <div style={{ fontSize: 34 }}>🔗</div>
              เลือกผลิตภัณฑ์และช่องทาง แล้วกดสร้าง
              <br />
              ระบบจะออกเลขเคส สร้างลิงก์ และคัดลอกข้อความให้อัตโนมัติ
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="pad spread" style={{ borderBottom: '1px solid var(--line)' }}>
          <h2>{scope === 'all' ? 'เคสทั้งทีม' : 'เคสของฉัน'}</h2>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            {user.role !== 'agent' && (
              <div className="seg">
                {[['mine', 'ของฉัน'], ['all', 'ทั้งทีม']].map(([v, l]) => (
                  <button type="button" key={v} className={scope === v ? 'on' : ''} onClick={() => { setScope(v); load({ scope: v }); }}>{l}</button>
                ))}
              </div>
            )}
            <select className="input" style={{ width: 140 }} value={statusF} onChange={(e) => { setStatusF(e.target.value); load({ status: e.target.value }); }}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className="input" style={{ width: 220 }} placeholder="ค้นหาเลขเคส / เลขอ้างอิง" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn">ค้นหา</button>
          </form>
        </div>
        <div className="tablewrap">
          {!list ? (
            <div className="empty">กำลังโหลด…</div>
          ) : !list.length ? (
            <div className="empty">ยังไม่มีเคสในช่วง 2 เดือนล่าสุด{q ? ' ที่ตรงกับคำค้นหา' : ''}</div>
          ) : (
            <table className="t">
              <thead>
                <tr>
                  <th>เลขเคส</th>
                  <th>ผลิตภัณฑ์</th>
                  <th>ช่องทาง</th>
                  {scope === 'all' && <th>ผู้ดูแล</th>}
                  <th>เลขอ้างอิง</th>
                  <th>สร้างเมื่อ</th>
                  <th>สถานะลิงก์</th>
                  <th>คะแนน</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.no}>
                    <td className="mono">
                      {c.no}
                      {c.parentCase && <div className="small muted">ต่อจาก {c.parentCase}</div>}
                    </td>
                    <td>{pName(c.product)}</td>
                    <td>{chName(c.channel)}</td>
                    {scope === 'all' && <td>{c.agentNick}</td>}
                    <td className="small">{c.extRef || <span className="muted">–</span>}</td>
                    <td className="small">{fmt(c.createdAt)}</td>
                    <td>
                      <span className={`badge ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span>
                      {c.status === 'answered' && !c.final && <div className="small muted">ยังไม่กดส่งรายละเอียด</div>}
                    </td>
                    <td>
                      <Stars n={c.score} />
                      {c.fuStatus && c.fuStatus !== 'cancelled' && (
                        <div>
                          <a className="small" href={`/followups?case=${c.no}`}>ติดตาม →</a>
                        </div>
                      )}
                    </td>
                    <td className="r">
                      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        {(c.status === 'created' || c.status === 'opened') && (
                          <>
                            <button className="btn sm" onClick={() => copyFor(c)}>คัดลอกข้อความ</button>
                            <button className="btn sm" onClick={() => setQr(c)}>QR</button>
                          </>
                        )}
                        <button className="btn sm ghost" title="ลูกค้ากลับมาด้วยปัญหาใหม่ → เปิดเคสใหม่พร้อมลิงก์ใหม่" onClick={() => reopen(c)}>เปิดเคสใหม่</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {qr && <QrModal c={qr} onClose={() => setQr(null)} />}
      {toast}
    </div>
  );
}
