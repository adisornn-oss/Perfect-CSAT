'use client';
import { useEffect, useState } from 'react';
import { api, useToast, copyText, Avatar } from '@/components/Shell';

const ROLE = { agent: 'CS Agent', lead: 'CS Lead', admin: 'Admin' };
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const mLabel = (m) => `${TH_M[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

function Users({ d, run, say }) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState('agent');
  const [invites, setInvites] = useState(null);
  const [busy, setBusy] = useState(false);
  const count = emails.split(/[\s,;]+/).filter((x) => x.includes('@')).length;

  async function add() {
    setBusy(true);
    try {
      const j = await api('/api/admin', { method: 'POST', body: { action: 'users.add', emails, role } });
      setInvites(j);
      setEmails('');
      await run(null);
    } catch (e) {
      say(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function linkFor(u) {
    const j = await api('/api/admin', { method: 'POST', body: { action: 'user.link', id: u.id } });
    if (await copyText(j.link)) say(`คัดลอกลิงก์ของ ${u.nickname || u.email} แล้ว`);
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="note-line">
        {d.googleEnabled ? (
          <>พนักงาน <b>@{d.settings.autoJoinDomain}</b> เข้าด้วย Google ได้เลย ระบบสร้างบัญชีเป็น {ROLE[d.settings.autoJoinRole]} ให้อัตโนมัติ และดึงชื่อจาก Google มาใช้ — Admin แค่ปรับบทบาทหัวหน้าทีม</>
        ) : (
          <>ยังไม่ได้เชื่อม Google — เพิ่มอีเมลด้านล่างแล้วส่งลิงก์เข้าสู่ระบบให้แต่ละคน (คลิกเดียว ไม่ต้องตั้งรหัสผ่าน)</>
        )}
      </div>

      <div className="panel panel-b stack" style={{ gap: 10 }}>
        <h2>เพิ่มคนเข้าทีม</h2>
        <textarea className="input" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={`วางอีเมลได้หลายรายการ คั่นด้วยบรรทัดใหม่หรือจุลภาค\nเช่น somchai.k@${d.settings.autoJoinDomain || 'thunder.in.th'}`} />
        <div className="spread">
          <div className="seg">
            {Object.entries(ROLE).map(([k, v]) => <button key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>{v}</button>)}
          </div>
          <button className="btn primary" disabled={!count || busy} onClick={add}>{busy ? 'กำลังเพิ่ม…' : count > 1 ? `เพิ่ม ${count} คน` : 'เพิ่ม'}</button>
        </div>
        <div className="xs muted">ชื่อและชื่อเล่นจะถูกเติมจากบัญชี Google ตอนเข้าใช้ครั้งแรก ไม่ต้องกรอก</div>
      </div>

      {invites && (invites.invites.length > 0 || invites.skipped.length > 0) && (
        <div className="panel">
          <div className="panel-h">
            <h2>ลิงก์เข้าสู่ระบบ</h2>
            {invites.invites.length > 0 && (
              <button className="btn sm" onClick={async () => (await copyText(invites.invites.map((x) => `${x.email}\n${x.link}`).join('\n\n'))) && say('คัดลอกทั้งหมดแล้ว')}>คัดลอกทั้งหมด</button>
            )}
          </div>
          <div className="tablewrap">
            <table className="t">
              <tbody>
                {invites.invites.map((x) => (
                  <tr key={x.email}>
                    <td>{x.email}</td>
                    <td className="xs muted">{x.mailed ? 'ส่งอีเมลให้แล้ว' : 'ส่งลิงก์นี้ให้ทางแชต · ใช้ได้ 1 ครั้งใน 7 วัน'}</td>
                    <td className="r"><button className="btn sm" onClick={async () => (await copyText(x.link)) && say('คัดลอกลิงก์แล้ว')}>คัดลอกลิงก์</button></td>
                  </tr>
                ))}
                {invites.skipped.map((x) => (
                  <tr key={x.email}><td className="muted">{x.email}</td><td className="xs muted" colSpan={2}>ข้าม — {x.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel tablewrap">
        <table className="t">
          <thead><tr><th>คน</th><th>ชื่อที่ลูกค้าเห็น</th><th>บทบาท</th><th>เข้าใช้ล่าสุด</th><th /></tr></thead>
          <tbody>
            {d.users.map((u) => (
              <tr key={u.id} style={u.active === false ? { opacity: 0.5 } : undefined}>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
                    <Avatar user={u} />
                    <div style={{ lineHeight: 1.3 }}>
                      <div>{u.name}{u.autoName && <span className="xs muted"> · รอเข้าใช้ครั้งแรก</span>}</div>
                      <div className="xs muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <input className="input" style={{ width: 130, height: 30 }} defaultValue={u.nickname} onBlur={(e) => e.target.value.trim() && e.target.value !== u.nickname && run({ action: 'user.update', id: u.id, nickname: e.target.value }, 'บันทึกแล้ว')} />
                </td>
                <td>
                  <select className="input" style={{ width: 118, height: 30 }} value={u.role} onChange={(e) => run({ action: 'user.update', id: u.id, role: e.target.value }, 'เปลี่ยนบทบาทแล้ว')}>
                    {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="small soft">{u.lastLoginAt ? fmt(u.lastLoginAt) : <span className="muted">ยังไม่เคย</span>}</td>
                <td className="r">
                  <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', gap: 4 }}>
                    {u.active !== false && <button className="btn sm" onClick={() => linkFor(u)}>คัดลอกลิงก์เข้าระบบ</button>}
                    <button className="btn sm quiet" onClick={() => run({ action: 'user.update', id: u.id, active: u.active === false }, u.active === false ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว')}>
                      {u.active === false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Products({ d, run }) {
  const blank = { code: '', name: '', brand: '', color: '#1E6FF0', logo: '', contact: '', active: true };
  const [f, setF] = useState(blank);
  return (
    <div className="stack">
      <div className="cols">
        {d.products.map((p) => (
          <div key={p.code} className="panel panel-b stack" style={{ borderTop: `4px solid ${p.color}` }}>
            <div className="spread">
              <div className="row">
                {p.logo && <img src={p.logo} alt="" style={{ height: 28 }} />}
                <b>{p.name}</b> <span className="tag mono">{p.code}</span>
                {p.brand && p.brand !== p.name && <span className="xs muted">{p.brand}</span>}
                {p.active === false && <span className="st red">ปิดใช้งาน</span>}
              </div>
              <button className="btn sm" onClick={() => setF(p)}>แก้ไข</button>
            </div>
            <div className="small muted">ช่องทางติดต่อ (แสดงเมื่อลิงก์หมดอายุ): {p.contact || '–'}</div>
          </div>
        ))}
      </div>
      <div className="panel panel-b stack">
        <h2>{d.products.some((p) => p.code === f.code) ? `แก้ไข ${f.code}` : 'เพิ่มผลิตภัณฑ์'}</h2>
        <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
          <label className="field">รหัส (2–4 ตัว ใช้ในเลขเคส)<input className="input mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} maxLength={4} /></label>
          <label className="field">ชื่อผลิตภัณฑ์<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Thunder Bot" /></label>
          <label className="field">แบรนด์ / บริษัท<input className="input" value={f.brand || ''} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Thunder Solution" /></label>
          <label className="field">สีแบรนด์<input className="input" type="color" style={{ width: 70, padding: 4 }} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></label>
          <label className="field" style={{ flex: 1 }}>URL โลโก้<input className="input" value={f.logo} onChange={(e) => setF({ ...f, logo: e.target.value })} placeholder="/logos/bs.png หรือ https://…" /></label>
        </div>
        <label className="field">ช่องทางติดต่อซัพพอร์ต<input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
        <div className="spread">
          <label className="row small"><input type="checkbox" checked={f.active !== false} onChange={(e) => setF({ ...f, active: e.target.checked })} /> เปิดใช้งาน</label>
          <div className="row">
            <button className="btn" onClick={() => setF(blank)}>ล้าง</button>
            <button className="btn primary" onClick={() => run({ action: 'product.save', ...f }, 'บันทึกผลิตภัณฑ์แล้ว').then((ok) => ok && setF(blank))}>บันทึก</button>
          </div>
        </div>
        <div className="small muted">เลขเคสรูปแบบ [รหัส]-[YYMM]-[ลำดับ 4 หลัก] เริ่ม 0001 ใหม่ทุกเดือน แยกตามผลิตภัณฑ์ · การเปลี่ยนรหัสไม่กระทบเคสเดิม</div>
      </div>
    </div>
  );
}

function Form({ d, run }) {
  const cur = d.forms[0];
  const [f, setF] = useState({ ...cur, improveOptions: cur.improveOptions.join('\n'), impressOptions: cur.impressOptions.join('\n') });
  const field = (k, label) => (
    <label className="field">{label}<input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  return (
    <div className="cols-21" style={{ alignItems: 'start' }}>
      <div className="panel panel-b stack">
        <div className="spread"><h2>แบบประเมิน (เวอร์ชันปัจจุบัน v{cur.version})</h2></div>
        <div className="note-line">บันทึกแล้วระบบจะสร้างเวอร์ชันใหม่ คำตอบเก่ายังผูกกับเวอร์ชันเดิม ไม่ถูกกระทบ · สเกล 1–5 (แย่มาก → ดีมาก) และตัวเลือกการแก้ปัญหาเป็นค่าคงที่ตามนิยาม KPI</div>
        {field('scoreQuestion', 'คำถามหลัก (คะแนน 1–5)')}
        {field('improveQuestion', 'คำถามเมื่อให้ 1–3')}
        <label className="field">ตัวเลือก "ควรปรับปรุง" (บรรทัดละ 1 ข้อ)<textarea className="input" rows={7} value={f.improveOptions} onChange={(e) => setF({ ...f, improveOptions: e.target.value })} /></label>
        {field('impressQuestion', 'คำถามเมื่อให้ 4–5')}
        <label className="field">ตัวเลือก "ประทับใจ" (บรรทัดละ 1 ข้อ)<textarea className="input" rows={6} value={f.impressOptions} onChange={(e) => setF({ ...f, impressOptions: e.target.value })} /></label>
        {field('resolvedQuestion', 'คำถามสถานะการแก้ปัญหา')}
        {field('commentQuestion', 'หัวข้อช่องความเห็น')}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={() => run({ action: 'form.save', ...f }, 'บันทึกเวอร์ชันใหม่แล้ว')}>บันทึกเป็นเวอร์ชันใหม่</button>
        </div>
      </div>
      <div className="panel panel-b">
        <h2 style={{ marginBottom: 8 }}>ประวัติเวอร์ชัน</h2>
        {d.forms.map((v) => (
          <div className="log" key={v.version}>
            <b>v{v.version}</b> · {fmt(v.createdAt)} {v.createdBy ? `· ${v.createdBy}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function Templates({ d, run }) {
  const keys = [{ code: '*', name: 'ค่าเริ่มต้น (ทุกผลิตภัณฑ์)' }, ...d.products.map((p) => ({ code: p.code, name: p.name }))];
  const [prod, setProd] = useState('*');
  const [ch, setCh] = useState('line');
  const key = `${prod}|${ch}`;
  const effective = d.templates[key] ?? (prod !== '*' ? d.templates[`*|${ch}`] : undefined) ?? d.defaultTemplates[ch];
  const [text, setText] = useState(effective);
  useEffect(() => setText(d.templates[key] ?? (prod !== '*' ? d.templates[`*|${ch}`] : undefined) ?? d.defaultTemplates[ch]), [key, d]);
  return (
    <div className="panel panel-b stack">
      <h2>เทมเพลตข้อความแนบลิงก์</h2>
      <div className="small muted">ตัวแปร: <code>{'{product}'}</code> ชื่อผลิตภัณฑ์ · <code>{'{agent}'}</code> ชื่อเล่นผู้ดูแล · <code>{'{case}'}</code> เลขเคส · <code>{'{link}'}</code> ลิงก์ · <code>{'{days}'}</code> อายุลิงก์ (วัน)</div>
      <div className="row">
        <div className="seg">{keys.map((k) => <button key={k.code} className={prod === k.code ? 'on' : ''} onClick={() => setProd(k.code)}>{k.name}</button>)}</div>
      </div>
      <div className="seg">{d.channels.map((c) => <button key={c.id} className={ch === c.id ? 'on' : ''} onClick={() => setCh(c.id)}>{c.label}</button>)}</div>
      <textarea className="input" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="spread">
        <span className="small muted">{d.templates[key] ? 'มีการกำหนดเฉพาะ' : 'กำลังใช้ค่าเริ่มต้น'}</span>
        <div className="row">
          {d.templates[key] && <button className="btn" onClick={() => run({ action: 'template.save', key, text: '' }, 'คืนค่าเริ่มต้นแล้ว')}>คืนค่าเริ่มต้น</button>}
          <button className="btn primary" onClick={() => run({ action: 'template.save', key, text }, 'บันทึกเทมเพลตแล้ว')}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

function Settings({ d, run }) {
  const s = d.settings;
  const [f, setF] = useState({ ...s, holidays: (s.holidays || []).join(', '), alertEmails: (s.alertEmails || []).join(', ') });
  const num = (k, label, hint) => (
    <label className="field">{label}<input className="input" type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />{hint && <span className="hint">{hint}</span>}</label>
  );
  return (
    <div className="panel panel-b stack">
      <h2>เป้าหมายและเกณฑ์</h2>
      <div className="cols">
        {num('csatTarget', 'เป้าหมาย CSAT (%)', 'ให้ตรงกับช่อง "เป้าหมาย" ในชีต KPI')}
        {num('responseRateTarget', 'เป้าหมายอัตราตอบกลับ (%)')}
        {num('sendRateTarget', 'เป้าหมายสัดส่วนเคสที่ส่งลิงก์ (%)')}
        {num('linkTtlDays', 'อายุลิงก์ (วัน)', 'มีผลกับลิงก์ที่สร้างใหม่')}
        {num('minSample', 'ผู้ตอบขั้นต่ำต่อเดือน (แสดงคำเตือน)')}
        {num('minAgentSample', 'ผู้ตอบขั้นต่ำต่อคน (ใช้ประเมินผลงาน)')}
      </div>
      <div className="cols">
        <label className="field">โดเมนที่เข้าใช้ได้อัตโนมัติด้วย Google<input className="input" value={f.autoJoinDomain || ''} onChange={(e) => setF({ ...f, autoJoinDomain: e.target.value })} placeholder="thunder.in.th" /><span className="hint">เว้นว่าง = ต้องให้ Admin เพิ่มอีเมลก่อนทุกครั้ง</span></label>
        <label className="field">บทบาทเริ่มต้นของคนที่เข้ามาเอง
          <select className="input" value={f.autoJoinRole || 'agent'} onChange={(e) => setF({ ...f, autoJoinRole: e.target.value })}>
            <option value="agent">CS Agent</option>
            <option value="lead">CS Lead</option>
          </select>
        </label>
      </div>
      <label className="field">ลิงก์นโยบายความเป็นส่วนตัว (แสดงในหน้าประเมิน)<input className="input" value={f.privacyUrl} onChange={(e) => setF({ ...f, privacyUrl: e.target.value })} /></label>
      <label className="field">วันหยุดบริษัท (ไม่นับเป็นวันทำการ) รูปแบบ YYYY-MM-DD คั่นด้วยจุลภาค<textarea className="input" rows={2} value={f.holidays} onChange={(e) => setF({ ...f, holidays: e.target.value })} placeholder="2026-10-23, 2026-12-05, 2026-12-10, 2026-12-31" /></label>
      <label className="field">อีเมลรับแจ้งเตือนคะแนนต่ำ (เว้นว่าง = ส่งถึง CS Lead และ Admin ทุกคน)<input className="input" value={f.alertEmails} onChange={(e) => setF({ ...f, alertEmails: e.target.value })} /></label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={() => run({ action: 'settings.save', ...f }, 'บันทึกการตั้งค่าแล้ว')}>บันทึก</button>
      </div>
    </div>
  );
}

function Closed({ d, run }) {
  return (
    <div className="panel panel-b stack">
      <h2>จำนวนเคสที่ปิดต่อเดือน</h2>
      <div className="small muted">ใช้คำนวณ "สัดส่วนเคสที่ส่งลิงก์ = ลิงก์ที่ส่ง ÷ เคสที่ปิด" ใน Dashboard (เฟสแรกยังไม่เชื่อมระบบแชต จึงกรอกจากรายงานของระบบแชต/ticket)</div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>เดือน</th>{d.products.map((p) => <th key={p.code}>{p.name}</th>)}</tr></thead>
          <tbody>
            {[...d.months].reverse().map((m) => (
              <tr key={m}>
                <td>{mLabel(m)}</td>
                {d.products.map((p) => (
                  <td key={p.code}>
                    <input
                      className="input num"
                      type="number"
                      min="0"
                      style={{ width: 120 }}
                      defaultValue={d.closed[m]?.[p.code] ?? ''}
                      onBlur={(e) => String(d.closed[m]?.[p.code] ?? '') !== e.target.value && run({ action: 'closed', month: m, product: p.code, count: e.target.value }, 'บันทึกแล้ว')}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Alerts({ d }) {
  const n = d.notifyChannels;
  const st = (ok) => (ok ? <span className="st green">เชื่อมแล้ว</span> : <span className="st">ยังไม่ตั้งค่า</span>);
  return (
    <div className="stack">
      <div className="panel panel-b stack">
        <h2>ช่องทางแจ้งเตือนคะแนนต่ำ</h2>
        <div className="row">LINE กลุ่มทีม (Messaging API) {st(n.line)}</div>
        <div className="row">อีเมล (Resend) {st(n.email)}</div>
        <div className="row">Webhook (Google Chat / Slack / Discord) {st(n.webhook)}</div>
        <div className="small muted">ตั้งค่าผ่าน Environment Variables บน Vercel: <code>LINE_CHANNEL_ACCESS_TOKEN</code> + <code>LINE_TO</code>, <code>RESEND_API_KEY</code> + <code>MAIL_FROM</code>, <code>ALERT_WEBHOOK_URL</code> · ทุกการแจ้งเตือนถูกบันทึกไว้ด้านล่างเสมอ และแสดงเป็นตัวเลขแดงที่เมนู "ติดตามคะแนนต่ำ"</div>
      </div>
      <div className="panel tablewrap">
        <table className="t">
          <thead><tr><th>เวลา</th><th>ข้อความ</th><th>ผลการส่ง</th></tr></thead>
          <tbody>
            {!d.outbox.length && <tr><td colSpan={3} className="empty">ยังไม่มีการแจ้งเตือน</td></tr>}
            {d.outbox.map((o, i) => (
              <tr key={i}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmt(o.at)}</td>
                <td className="small" style={{ whiteSpace: 'pre-wrap' }}>{o.text}</td>
                <td className="small">{Object.entries(o.results || {}).map(([k, v]) => <div key={k}>{k}: {v}</div>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Audit({ d }) {
  return (
    <div className="panel tablewrap">
      <table className="t">
        <thead><tr><th>เวลา</th><th>ผู้ทำ</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead>
        <tbody>
          {d.audit.map((a, i) => (
            <tr key={i}>
              <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmt(a.at)}</td>
              <td className="small">{a.by}</td>
              <td className="mono small">{a.action}</td>
              <td className="small mono" style={{ wordBreak: 'break-all' }}>{JSON.stringify(a.detail)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminClient({ user }) {
  const isAdmin = user.role === 'admin';
  const [d, setD] = useState(null);
  const [tab, setTab] = useState(isAdmin ? 'users' : 'closed');
  const [err, setErr] = useState('');
  const [toast, say] = useToast();
  const load = () => api('/api/admin').then(setD).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function run(body, okMsg) {
    try {
      if (body) await api('/api/admin', { method: 'POST', body });
      if (okMsg) say(okMsg);
      await load();
      return true;
    } catch (e) {
      say(e.message);
      return false;
    }
  }

  if (err) return <div className="note-line bad">{err}</div>;
  if (!d) return <div className="empty">กำลังโหลด…</div>;
  const tabs = isAdmin
    ? [['users', 'ทีม'], ['settings', 'เป้าหมาย'], ['form', 'แบบประเมิน'], ['templates', 'ข้อความส่งลูกค้า'], ['products', 'ผลิตภัณฑ์'], ['closed', 'ยอดเคสที่ปิด'], ['alerts', 'การแจ้งเตือน'], ['audit', 'ประวัติการแก้ไข']]
    : [['closed', 'เคสที่ปิด']];
  const P = { users: Users, products: Products, form: Form, templates: Templates, settings: Settings, closed: Closed, alerts: Alerts, audit: Audit }[tab];
  return (
    <div>
      <div className="pagehead"><h1>{isAdmin ? 'ตั้งค่า' : 'ยอดเคสที่ปิด'}</h1></div>
      {tabs.length > 1 && (
        <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      )}
      <P d={d} run={run} say={say} />
      {toast}
    </div>
  );
}
