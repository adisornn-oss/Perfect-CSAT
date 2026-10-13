'use client';
import { useEffect, useState } from 'react';
import { api, useToast } from '@/components/Shell';
import { Stars } from '@/app/cases/CasesClient';

const FU = {
  pending: ['รอติดตาม', 'red'],
  contacted: ['ติดต่อแล้ว', 'amber'],
  closed: ['ปิดเรื่อง', 'green'],
  cancelled: ['ยกเลิก', ''],
};
const RES = { yes: 'แก้ได้แล้ว', partial: 'แก้ได้บางส่วน', no: 'ยังไม่ได้' };
const CH = { line: 'LINE OA', messenger: 'Messenger', email: 'อีเมล', sms: 'SMS', phone: 'โทรศัพท์' };
const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

function Item({ b, users, products, isLead, me, onSaved, focus }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { case: c, resp: r, fu } = b;
  const p = products.find((x) => x.code === c.product);
  const overdue = fu.status === 'pending' && Date.now() > new Date(fu.deadline).getTime();
  const canEdit = isLead || fu.assigneeId === me.id || c.agentId === me.id;

  async function save(patch) {
    setBusy(true);
    try {
      await onSaved(c.no, patch);
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id={c.no} className="card pad stack" style={focus ? { outline: '2px solid var(--brand)' } : undefined}>
      <div className="spread">
        <div className="row">
          <b className="mono">{c.no}</b>
          <span className="badge" style={{ color: p?.color }}>{p?.name || c.product}</span>
          <span className="small muted">{CH[c.channel]} · ผู้ดูแล {c.agentNick}{c.extRef ? ` · อ้างอิง ${c.extRef}` : ''}</span>
        </div>
        <div className="row">
          {overdue && <span className="badge red">⏰ เลยกำหนด 1 วันทำการ</span>}
          <span className={`badge ${FU[fu.status][1]}`}>{FU[fu.status][0]}</span>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        <div>
          <Stars n={r?.score} /> <b>{r?.score}/5</b>
          <div className="small muted">ตอบเมื่อ {fmt(r?.answeredAt)}</div>
        </div>
        <div className="grow small">
          {r?.final ? (
            <>
              {r.reasons?.length > 0 && <div>ควรปรับปรุง: <b>{r.reasons.join(', ')}</b></div>}
              <div>สถานะปัญหา: <b>{RES[r.resolved] || '–'}</b></div>
              {r.comment && <div style={{ marginTop: 4 }}>“{r.comment}”</div>}
            </>
          ) : (
            <span className="muted">ลูกค้ากดคะแนนแล้ว แต่ยังไม่ได้ส่งรายละเอียด</span>
          )}
        </div>
        <div className="small" style={{ textAlign: 'right' }}>
          ต้องติดต่อภายใน
          <div><b>{fmt(fu.deadline)}</b></div>
          {fu.contactedAt && <div className="muted">ติดต่อแล้ว {fmt(fu.contactedAt)}</div>}
        </div>
      </div>

      {fu.notes?.length > 0 && (
        <div>
          {fu.notes.map((n, i) => (
            <div className="note" key={i}>
              {n.text}
              <div className="muted small">{n.by} · {fmt(n.at)}</div>
            </div>
          ))}
        </div>
      )}

      {canEdit && fu.status !== 'cancelled' && (
        <div className="stack" style={{ gap: 8 }}>
          <textarea className="input" rows={2} placeholder="บันทึกสิ่งที่ทำ เช่น โทรคุยกับลูกค้าแล้ว แก้ไขการตั้งค่า sender name ให้…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="spread">
            <div className="row">
              {isLead && (
                <label className="row small">
                  ผู้รับผิดชอบ
                  <select className="input" style={{ width: 160 }} value={fu.assigneeId} onChange={(e) => save({ assigneeId: e.target.value })} disabled={busy}>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
              )}
              {!isLead && <span className="small muted">ผู้รับผิดชอบ: {users.find((u) => u.id === fu.assigneeId)?.name}</span>}
            </div>
            <div className="row">
              <button className="btn sm" disabled={busy || !note.trim()} onClick={() => save({ note })}>บันทึก</button>
              {fu.status === 'pending' && <button className="btn sm primary" disabled={busy} onClick={() => save({ status: 'contacted', note })}>ติดต่อลูกค้าแล้ว</button>}
              {fu.status !== 'closed' && <button className="btn sm" disabled={busy} onClick={() => save({ status: 'closed', note })}>ปิดเรื่อง</button>}
              {fu.status === 'closed' && <button className="btn sm ghost" disabled={busy} onClick={() => save({ status: 'contacted', note })}>เปิดเรื่องอีกครั้ง</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FollowupsClient({ user }) {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('open');
  const [err, setErr] = useState('');
  const [focus, setFocus] = useState('');
  const [toast, say] = useToast();
  const isLead = user.role !== 'agent';

  const load = () => api('/api/followups').then(setD).catch((e) => setErr(e.message));
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('case');
    if (c) {
      setFocus(c);
      setTab('all');
    }
    load();
  }, []);
  useEffect(() => {
    if (focus && d) setTimeout(() => document.getElementById(focus)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }, [focus, d]);

  async function onSaved(no, patch) {
    try {
      await api(`/api/followups/${no}`, { method: 'PATCH', body: patch });
      say('บันทึกแล้ว');
      await load();
    } catch (e) {
      say(e.message);
    }
  }

  if (err) return <div className="alert bad">{err}</div>;
  if (!d) return <div className="empty">กำลังโหลด…</div>;
  const counts = { open: 0, pending: 0, contacted: 0, closed: 0, all: d.rows.length };
  d.rows.forEach((b) => {
    counts[b.fu.status] = (counts[b.fu.status] || 0) + 1;
    if (b.fu.status === 'pending' || b.fu.status === 'contacted') counts.open += 1;
  });
  const rows = d.rows.filter((b) =>
    tab === 'all' ? true : tab === 'open' ? b.fu.status === 'pending' || b.fu.status === 'contacted' : b.fu.status === tab,
  );

  return (
    <div>
      <div className="pagehead">
        <h1>ติดตามคะแนนต่ำ (1–3)</h1>
        <div className="small muted">
          ระบบแจ้งเตือนหัวหน้าทีมทันทีที่ลูกค้าให้คะแนน 1–3 · ต้องติดต่อกลับภายใน 1 วันทำการ · เตือนซ้ำอัตโนมัติถ้าเลยกำหนด
          {!isLead && ' · แสดงเฉพาะเคสของคุณ'}
        </div>
      </div>
      <div className="tabs">
        {[
          ['open', 'ยังไม่ปิด'],
          ['pending', 'รอติดตาม'],
          ['contacted', 'ติดต่อแล้ว'],
          ['closed', 'ปิดเรื่อง'],
          ['all', 'ทั้งหมด'],
        ].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l} <span className="muted">({counts[k] || 0})</span>
          </button>
        ))}
      </div>
      {!rows.length ? (
        <div className="card empty">🎉 ไม่มีเคสคะแนนต่ำในหมวดนี้</div>
      ) : (
        <div className="stack">
          {rows.map((b) => (
            <Item key={b.case.no} b={b} users={d.users} products={d.products} isLead={isLead} me={user} onSaved={onSaved} focus={focus === b.case.no} />
          ))}
        </div>
      )}
      {toast}
    </div>
  );
}
