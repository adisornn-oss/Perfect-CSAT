'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const ROLE_LABEL = { agent: 'CS Agent', lead: 'CS Lead', admin: 'Admin' };

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

function PasswordModal({ onClose }) {
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [msg, setMsg] = useState('');
  async function save() {
    try {
      await api('/api/me', { method: 'PATCH', body: { currentPassword: cur, newPassword: nw } });
      setMsg('เปลี่ยนรหัสผ่านแล้ว');
      setTimeout(onClose, 900);
    } catch (e) {
      setMsg(e.message);
    }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal card pad-lg stack" onClick={(e) => e.stopPropagation()}>
        <h2>เปลี่ยนรหัสผ่าน</h2>
        <label className="field">
          รหัสผ่านปัจจุบัน
          <input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </label>
        <label className="field">
          รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
          <input className="input" type="password" value={nw} onChange={(e) => setNw(e.target.value)} />
        </label>
        {msg && <div className="alert info">{msg}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={nw.length < 8}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

export default function Shell({ user, children }) {
  const path = usePathname();
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);

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
    { href: '/cases', label: 'สร้างลิงก์ / เคส' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/followups', label: 'ติดตามคะแนนต่ำ', count: pending },
  ];
  if (user.role !== 'agent') links.push({ href: '/admin', label: user.role === 'admin' ? 'ตั้งค่า' : 'ข้อมูลเคสปิด' });

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <a className="logo" href="/">
            <img className="logo-mark" src="/brand-mark.jpg" alt="" /> Perfect <b>CSAT</b>
          </a>
          <nav className="nav">
            {links.map((l) => (
              <a key={l.href} href={l.href} className={path.startsWith(l.href) ? 'on' : ''}>
                {l.label}
                {l.count ? <span className="count">{l.count}</span> : null}
              </a>
            ))}
          </nav>
          <div className="userbox">
            <button className="btn ghost" onClick={() => setOpen((o) => !o)}>
              {user.nickname || user.name} <span className="badge">{ROLE_LABEL[user.role]}</span>
            </button>
            {open && (
              <div className="menu" onMouseLeave={() => setOpen(false)}>
                <div className="small muted" style={{ padding: '6px 10px' }}>{user.email}</div>
                <button onClick={() => { setPw(true); setOpen(false); }}>เปลี่ยนรหัสผ่าน</button>
                <button onClick={logout}>ออกจากระบบ</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
      {pw && <PasswordModal onClose={() => setPw(false)} />}
    </>
  );
}
