'use client';
import { useState } from 'react';

const STAR = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2.8c.4 0 .8.2 1 .6l2.4 4.9 5.4.8c.9.1 1.3 1.2.6 1.9l-3.9 3.8.9 5.4c.2.9-.8 1.6-1.6 1.2L12 18.8l-4.8 2.6c-.8.4-1.8-.3-1.6-1.2l.9-5.4-3.9-3.8c-.7-.7-.3-1.8.6-1.9l5.4-.8L11 3.4c.2-.4.6-.6 1-.6z"
    />
  </svg>
);

function Done({ title, children, icon = 'check' }) {
  return (
    <div className="sv-msg">
      <div className="ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon === 'check' ? <path d="M20 6 9 17l-5-5" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
        </svg>
      </div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export default function Survey({ token, initialScore, form, labels, resolvedOptions, commentMax, privacyUrl, contact }) {
  const [score, setScore] = useState(initialScore);
  const [reasons, setReasons] = useState([]);
  const [resolved, setResolved] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const low = score > 0 && score <= 3;
  const options = low ? form.improveOptions : form.impressOptions;

  async function post(payload) {
    const r = await fetch(`/api/r/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409) return setDone('answered');
    if (r.status === 410) return setDone('expired');
    if (!r.ok) throw new Error(j.error || 'ส่งไม่สำเร็จ ลองอีกครั้ง');
    return j;
  }

  // the score is stored the moment a star is tapped
  async function pick(n) {
    if ((score > 0 && score <= 3) !== n <= 3) setReasons([]);
    setScore(n);
    setError('');
    try {
      await post({ score: n, final: false });
    } catch (e) {
      setError(e.message);
    }
  }

  async function submit() {
    if (!resolved) return setError('ช่วยตอบอีกข้อว่าปัญหาได้รับการแก้ไขแล้วหรือยัง');
    setBusy(true);
    setError('');
    try {
      if (await post({ score, reasons, resolved, comment, final: true })) setDone('thanks');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done === 'thanks')
    return low ? (
      <Done title="ขอบคุณที่บอกเราตรง ๆ">ขอโทษที่ครั้งนี้เรายังดูแลได้ไม่ดีพอ ทีมงานจะติดต่อกลับภายใน 1 วันทำการเพื่อช่วยแก้ไขค่ะ</Done>
    ) : (
      <Done title="ขอบคุณค่ะ">คำตอบของคุณช่วยให้ทีมดูแลลูกค้าได้ดีขึ้นทุกวัน</Done>
    );
  if (done === 'answered') return <Done title="คุณประเมินเคสนี้แล้ว" />;
  if (done === 'expired') return <Done icon="clock" title="ลิงก์นี้หมดอายุแล้ว">ติดต่อเราได้ที่ {contact}</Done>;

  return (
    <>
      <h1 className="sv-q">{form.scoreQuestion}</h1>
      <div className="sv-stars" role="radiogroup" aria-label={form.scoreQuestion}>
        {labels.map((lb, i) => (
          <button
            key={lb}
            type="button"
            role="radio"
            aria-checked={score === i + 1}
            aria-label={`${i + 1} ดาว — ${lb}`}
            className={score > i ? 'fill' : ''}
            onClick={() => pick(i + 1)}
          >
            {STAR}
          </button>
        ))}
      </div>
      {score ? (
        <div className="sv-picked">{labels[score - 1]}</div>
      ) : (
        <div className="sv-scale">
          <span>{labels[0]}</span>
          <span>{labels[4]}</span>
        </div>
      )}

      {score > 0 && (
        <>
          <div className="sv-h">
            {low ? form.improveQuestion.replace(/\s*\(.*\)$/, '') : form.impressQuestion.replace(/\s*\(.*\)$/, '')} <span>เลือกได้หลายข้อ</span>
          </div>
          <div className="opts">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                className={reasons.includes(o) ? 'on' : ''}
                aria-pressed={reasons.includes(o)}
                onClick={() => setReasons((r) => (r.includes(o) ? r.filter((x) => x !== o) : [...r, o]))}
              >
                {o}
              </button>
            ))}
          </div>

          <div className="sv-h">{form.resolvedQuestion}</div>
          <div className="opts">
            {resolvedOptions.map((o) => (
              <button key={o.id} type="button" className={resolved === o.id ? 'on' : ''} aria-pressed={resolved === o.id} onClick={() => setResolved(o.id)}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="sv-h">
            {form.commentQuestion.replace(/\s*\(.*\)$/, '')} <span>ไม่บังคับ</span>
          </div>
          <textarea className="input" rows={3} maxLength={commentMax} value={comment} onChange={(e) => setComment(e.target.value)} />
          {comment.length > commentMax * 0.8 && (
            <div className="counter">
              {comment.length}/{commentMax}
            </div>
          )}

          {error && <div className="note-line bad" style={{ marginTop: 16 }}>{error}</div>}
          <div className="sv-send">
            <button className="btn lg" onClick={submit} disabled={busy}>
              {busy ? 'กำลังส่ง…' : 'ส่งคำตอบ'}
            </button>
          </div>
        </>
      )}
      {!score && error && <div className="note-line bad" style={{ marginTop: 16 }}>{error}</div>}

      <p className="sv-legal">
        เราใช้คำตอบนี้เพื่อปรับปรุงการให้บริการเท่านั้น และไม่เก็บชื่อ เบอร์โทร หรืออีเมลของคุณ —{' '}
        <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
          นโยบายความเป็นส่วนตัว
        </a>
      </p>
    </>
  );
}
