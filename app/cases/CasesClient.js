'use client';
import { useEffect, useRef, useState } from 'react';
import { api, copyText, useToast } from '@/components/Shell';

const STATUS = {
  created: ['ยังไม่เปิด', ''],
  opened: ['เปิดดูแล้ว', 'blue'],
  answered: ['ตอบแล้ว', 'green'],
  expired: ['หมดอายุ', 'amber'],
};
const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export function Stars({ n }) {
  if (!n) return <span className="muted">—</span>;
  return (
    <span className="stars" title={`${n}/5`}>
      {'★'.repeat(n)}
      <i>{'★'.repeat(5 - n)}</i>
    </span>
  );
}

function QrModal({ c, onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 340, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div className="mono soft small">{c.no}</div>
        <img src={`/api/cases/${c.no}/qr`} alt="QR code ของแบบประเมิน" width={240} height={240} style={{ display: 'block', margin: '12px auto' }} />
        <p className="small soft">ให้ลูกค้าสแกนเพื่อเปิดแบบประเมิน</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <a className="btn" href={`/api/cases/${c.no}/qr`} download={`${c.no}.svg`}>ดาวน์โหลด</a>
          <button className="btn primary" onClick={onClose}>เสร็จ</button>
        </div>
      </div>
    </div>
  );
}

export default function CasesClient({ user }) {
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [product, setProduct] = useState(user.lastProduct || '');
  const [channel, setChannel] = useState(user.lastChannel || 'line');
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
      if (!j.products.some((x) => x.code === product)) setProduct(j.products[0]?.code || '');
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
      setResult(j);
      setExtRef('');
      setParentCase(null);
      say((await copyText(j.message)) ? 'คัดลอกข้อความแล้ว วางส่งลูกค้าได้เลย' : `สร้าง ${j.case.no} แล้ว`);
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

  return (
    <div>
      <div className="pagehead">
        <div>
          <h1>ส่งแบบประเมิน</h1>
          <div className="sub">สร้างเลขเคสและลิงก์ในคลิกเดียว ข้อความถูกคัดลอกให้อัตโนมัติ</div>
        </div>
      </div>

      <div className="cols" style={{ alignItems: 'stretch' }}>
        <form className="panel panel-b stack" style={{ gap: 16 }} onSubmit={create}>
          {parentCase && (
            <div className="note-line spread">
              <span>เปิดเคสใหม่ต่อจาก <b className="mono">{parentCase.no}</b></span>
              <button type="button" className="btn quiet sm" onClick={() => setParentCase(null)}>ยกเลิก</button>
            </div>
          )}
          <div className="field">
            ผลิตภัณฑ์
            <div className="choices">
              {products.map((p) => (
                <button type="button" key={p.code} className={product === p.code ? 'on' : ''} onClick={() => setProduct(p.code)} disabled={Boolean(parentCase) && product !== p.code}>
                  <b>{p.name}</b>
                  <span>{p.brand && p.brand !== p.name ? p.brand : '\u00a0'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            ส่งทาง
            <div className="seg">
              {channels.map((c) => (
                <button type="button" key={c.id} className={channel === c.id ? 'on' : ''} onClick={() => setChannel(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            เลขอ้างอิงจากระบบแชต <span className="hint">ไม่บังคับ — เช่น ID แชต LINE OA เพื่อค้นย้อนหลัง</span>
            <input ref={refInput} className="input" value={extRef} onChange={(e) => setExtRef(e.target.value)} maxLength={120} />
          </label>
          {err && <div className="note-line bad">{err}</div>}
          <div className="spread" style={{ marginTop: 'auto' }}>
            <span className="xs muted">ผู้ดูแลเคส: {user.nickname || user.name}</span>
            <button className="btn primary" style={{ height: 38, padding: '0 16px' }} disabled={busy || !product || !channel}>
              {busy ? 'กำลังสร้าง…' : 'สร้างลิงก์'}
            </button>
          </div>
        </form>

        <div className="panel panel-b stack" style={{ gap: 12, background: result ? '#fff' : '#fcfcfb' }}>
          {result ? (
            <>
              <div className="spread">
                <span className="caseno">{result.case.no}</span>
                <span className="small soft">{pName(result.case.product)} · {chName(result.case.channel)}</span>
              </div>
              <div className="copybox">{result.message}</div>
              <div className="row">
                <button className="btn primary" onClick={async () => (await copyText(result.message)) && say('คัดลอกข้อความแล้ว')}>คัดลอกข้อความ</button>
                <button className="btn" onClick={async () => (await copyText(result.case.link)) && say('คัดลอกลิงก์แล้ว')}>คัดลอกลิงก์</button>
                <button className="btn" onClick={() => setQr(result.case)}>QR</button>
              </div>
              <div className="xs muted">ใช้ได้ถึง {fmt(result.case.expiresAt)} หรือจนกว่าลูกค้าจะตอบ</div>
            </>
          ) : (
            <div className="muted small" style={{ margin: 'auto', textAlign: 'center', lineHeight: 1.8 }}>
              ข้อความพร้อมลิงก์จะแสดงที่นี่
              <br />
              และถูกคัดลอกไว้ให้วางส่งลูกค้าได้ทันที
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-h">
          <h2>{scope === 'all' ? 'เคสทั้งทีม' : 'เคสของฉัน'} <span className="muted" style={{ fontWeight: 400 }}>· 2 เดือนล่าสุด</span></h2>
        </div>
        <form
          className="filters"
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
          <select className="input" value={statusF} onChange={(e) => { setStatusF(e.target.value); load({ status: e.target.value }); }}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="input" style={{ width: 240 }} placeholder="ค้นหาเลขเคสหรือเลขอ้างอิง" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <div className="panel tablewrap">
          {!list ? (
            <div className="empty">กำลังโหลด…</div>
          ) : !list.length ? (
            <div className="empty">{q ? 'ไม่พบเคสที่ตรงกับคำค้นหา' : 'ยังไม่มีเคส สร้างลิงก์แรกได้จากด้านบน'}</div>
          ) : (
            <table className="t">
              <thead>
                <tr>
                  <th>เลขเคส</th>
                  <th>ผลิตภัณฑ์</th>
                  <th>ช่องทาง</th>
                  {scope === 'all' && <th>ผู้ดูแล</th>}
                  <th>สร้างเมื่อ</th>
                  <th>สถานะ</th>
                  <th>คะแนน</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.no}>
                    <td>
                      <span className="mono">{c.no}</span>
                      {(c.extRef || c.parentCase) && (
                        <div className="xs muted">{[c.extRef, c.parentCase && `ต่อจาก ${c.parentCase}`].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td>{pName(c.product)}</td>
                    <td className="soft">{chName(c.channel)}</td>
                    {scope === 'all' && <td>{c.agentNick}</td>}
                    <td className="soft small">{fmt(c.createdAt)}</td>
                    <td>
                      <span className={`st ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span>
                      {c.status === 'answered' && !c.final && <div className="xs muted">ให้ดาวแล้ว ยังไม่กดส่ง</div>}
                    </td>
                    <td>
                      <Stars n={c.score} />
                      {c.fuStatus && c.fuStatus !== 'cancelled' && (
                        <div>
                          <a className="link xs" href={`/followups?case=${c.no}`}>ดูการติดตาม</a>
                        </div>
                      )}
                    </td>
                    <td className="r">
                      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', gap: 4 }}>
                        {(c.status === 'created' || c.status === 'opened') && (
                          <>
                            <button className="btn sm" onClick={() => copyFor(c)}>คัดลอก</button>
                            <button className="btn sm quiet" onClick={() => setQr(c)}>QR</button>
                          </>
                        )}
                        <button className="btn sm quiet" title="ลูกค้ากลับมาด้วยเรื่องใหม่ → ออกเลขเคสและลิงก์ใหม่" onClick={() => reopen(c)}>เปิดเคสใหม่</button>
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
