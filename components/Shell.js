'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const ROLE_LABEL = { agent: 'CS Agent', lead: 'CS Lead', admin: 'Admin' };

const I = {
  link: <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  flag: <path d="M4 22V4s1.5-1 5-1 5 2 8 2 3-.5 3-.5v11s-1 .5-3 .5-5-2-8-2-5 1-5 1" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  table: <path d="M3 5h18v14H3zM3 10h18M9 10v9" />,
};
export function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {I[name]}
    </svg>
  );
}

export function useToast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(''), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg ? <div className="toast">{msg}</div> : null, setMsg];
}

export async function api(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) {
    window.location.href = '/login';
    throw new Error('กรุณาเข้าสู่ระบบ');
  }
  if (!r.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
  return j;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function Avatar({ user }) {
  const initial = (user.nickname || user.name || user.email || '?').trim().charAt(0).toUpperCase();
  return <span className="avatar">{user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : initial}</span>;
}

function NicknameModal({ user, onClose }) {
  const [nick, setNick] = useState(user.nickname || '');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api('/api/me', { method: 'PATCH', body: { nickname: nick } });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h2>ชื่อที่ลูกค้าเห็น</h2>
        <p className="small soft">แสดงในหน้าประเมินและข้อความที่ส่งให้ลูกค้า เช่น “ดูแลโดย {nick || 'เอ'}”</p>
        <input className="input" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={40} autoFocus />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn quiet" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={busy || !nick.trim()}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

export default function Shell({ user, children }) {
  const path = usePathname();
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/me')
        .then((r) => r.json())
        .then((j) => alive && setPending(j.pendingFollowups || 0))
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [path]);

  const links = [
    { href: '/cases', label: 'ส่งแบบประเมิน', icon: 'link' },
    { href: '/dashboard', label: 'ภาพรวม CSAT', icon: 'chart' },
    { href: '/followups', label: 'คะแนนต่ำ', icon: 'flag', count: pending },
  ];
  if (user.role === 'admin') links.push({ href: '/admin', label: 'ตั้งค่า', icon: 'gear' });
  else if (user.role === 'lead') links.push({ href: '/admin', label: 'ยอดเคสที่ปิด', icon: 'table' });

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="app">
      <aside className="side">
        <a className="brand" href="/">
          <img src="/brand-mark.jpg" alt="" />
          <span>
            Perfect <em>CSAT</em>
          </span>
        </a>
        <nav className="nav">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={path.startsWith(l.href) ? 'on' : ''}>
              <Icon name={l.icon} />
              <span className="lbl">{l.label}</span>
              {l.count ? <span className="count">{l.count}</span> : null}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <button className="me" onClick={() => setOpen((o) => !o)}>
            <Avatar user={user} />
            <span className="who">
              <b>{user.nickname || user.name}</b>
              <span>{ROLE_LABEL[user.role]}</span>
            </span>
          </button>
          {open && (
            <div className="menu" onMouseLeave={() => setOpen(false)}>
              <div className="xs muted" style={{ padding: '6px 10px' }}>{user.email}</div>
              <button onClick={() => { setNick(true); setOpen(false); }}>แก้ชื่อที่ลูกค้าเห็น</button>
              <button onClick={logout}>ออกจากระบบ</button>
            </div>
          )}
        </div>
      </aside>
      <main className="main">
        <div className="page">{children}</div>
      </main>
      {nick && <NicknameModal user={user} onClose={() => setNick(false)} />}
    </div>
  );
}
