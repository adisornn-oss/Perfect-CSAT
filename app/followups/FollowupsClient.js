'use client';
import { useEffect, useState } from 'react';
import { api, useToast } from '@/components/Shell';

const FU = {
  pending: ['รอติดต่อ', 'red'],
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
    <div id={c.no} className="panel panel-b stack" style={focus ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}>
      <div className="spread">
        <div className="row">
          <b className="mono">{c.no}</b>
          <span className="small soft">{p?.name || c.product} · {CH[c.channel]} · {c.agentNick}{c.extRef ? ` · ${c.extRef}` : ''}</span>
        </div>
        <div className="row">
          {overdue && <span className="tag warn">เลยกำหนด</span>}
          <span className={`st ${FU[fu.status][1]}`}>{FU[fu.status][0]}</span>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }} className="num">{r?.score}<span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>/5</span></div>
          <div className="xs muted" style={{ marginTop: 4 }}>{fmt(r?.answeredAt)}</div>
        </div>
        <div className="grow small">
          {r?.final ? (
            <>
              {r.comment && <div className="quote" style={{ marginBottom: 4 }}>{r.comment}</div>}
              <div className="soft">
                {[r.reasons?.length && r.reasons.join(', '), `ปัญหา${RES[r.resolved] || '—'}`].filter(Boolean).join(' · ')}
              </div>
            </>
          ) : (
            <span className="muted">ลูกค้าให้ดาวแล้ว ยังไม่ได้กรอกรายละเอียด</span>
          )}
        </div>
        <div className="xs soft" style={{ textAlign: 'right' }}>
          {fu.contactedAt ? <>ติดต่อแล้ว {fmt(fu.contactedAt)}</> : <>ติดต่อภายใน<div style={{ color: overdue ? 'var(--bad)' : 'var(--ink)', fontSize: 13 }}>{fmt(fu.deadline)}</div></>}
        </div>
      </div>

      {fu.notes?.length > 0 && (
        <div>
          {fu.notes.map((n, i) => (
            <div className="log" key={i}>
              {n.text}
              <div className="xs muted">{n.by} · {fmt(n.at)}</div>
            </div>
          ))}
        </div>
      )}

      {canEdit && fu.status !== 'cancelled' && (
        <div className="stack" style={{ gap: 8 }}>
          <textarea className="input" rows={2} placeholder="ทำอะไรไปแล้วบ้าง" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="spread">
            <div className="row">
              {isLead && (
                <label className="row small soft">
                  ผู้รับผิดชอบ
                  <select className="input" style={{ width: 150 }} value={fu.assigneeId} onChange={(e) => save({ assigneeId: e.target.value })} disabled={busy}>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
              )}
              {!isLead && <span className="xs muted">ผู้รับผิดชอบ: {users.find((u) => u.id === fu.assigneeId)?.name}</span>}
            </div>
            <div className="row">
              <button className="btn sm quiet" disabled={busy || !note.trim()} onClick={() => save({ note })}>บันทึกโน้ต</button>
              {fu.status === 'pending' && <button className="btn sm primary" disabled={busy} onClick={() => save({ status: 'contacted', note })}>ติดต่อแล้ว</button>}
              {fu.status !== 'closed' && <button className="btn sm" disabled={busy} onClick={() => save({ status: 'closed', note })}>ปิดเรื่อง</button>}
              {fu.status === 'closed' && <button className="btn sm quiet" disabled={busy} onClick={() => save({ status: 'contacted', note })}>เปิดเรื่องอีกครั้ง</button>}
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

  if (err) return <div className="note-line bad">{err}</div>;
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
        <div>
          <h1>คะแนนต่ำ</h1>
          <div className="sub">ลูกค้าที่ให้ 1–3 ดาว ต้องติดต่อกลับภายใน 1 วันทำการ{!isLead && ' · เฉพาะเคสของคุณ'}</div>
        </div>
      </div>
      <div className="tabs">
        {[
          ['open', 'ยังไม่ปิด'],
          ['pending', 'รอติดต่อ'],
          ['contacted', 'ติดต่อแล้ว'],
          ['closed', 'ปิดเรื่อง'],
          ['all', 'ทั้งหมด'],
        ].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}<span className="c">{counts[k] || 0}</span>
          </button>
        ))}
      </div>
      {!rows.length ? (
        <div className="panel empty">ไม่มีเคสในหมวดนี้</div>
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
