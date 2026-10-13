'use client';
import { useState } from 'react';

export default function Survey({ token, initialScore, form, labels, resolvedOptions, commentMax, privacyUrl, contact }) {
  const [score, setScore] = useState(initialScore);
  const [reasons, setReasons] = useState([]);
  const [resolved, setResolved] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // null | 'thanks' | 'answered' | 'expired'

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
    if (!r.ok) throw new Error(j.error || 'ส่งไม่สำเร็จ กรุณาลองใหม่');
    return j;
  }

  // FR-308: store the score as soon as a star is tapped
  async function pick(n) {
    const wasLow = score > 0 && score <= 3;
    setScore(n);
    if (wasLow !== n <= 3) setReasons([]);
    setError('');
    try {
      await post({ score: n, final: false });
    } catch (e) {
      setError(e.message);
    }
  }

  async function submit() {
    if (!score) return setError('กรุณาเลือกระดับความพึงพอใจ');
    if (!resolved) return setError('กรุณาตอบว่าปัญหาได้รับการแก้ไขแล้วหรือยัง');
    setBusy(true);
    setError('');
    try {
      const j = await post({ score, reasons, resolved, comment, final: true });
      if (j) setDone('thanks');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done === 'thanks')
    return (
      <div className="sv-done">
        <div className="ic">{low ? '🙏' : '💙'}</div>
        <h2 style={{ marginTop: 10 }}>ขอบคุณสำหรับการประเมิน</h2>
        <div className="muted" style={{ marginTop: 8 }}>
          {low ? (
            <>
              ขออภัยที่การให้บริการยังไม่ดีพอ
              <br />
              ทีมงานจะติดต่อกลับภายใน <b style={{ color: 'var(--ink)' }}>1 วันทำการ</b> เพื่อช่วยแก้ไขให้ค่ะ
            </>
          ) : (
            'ความเห็นของคุณช่วยให้เราพัฒนาบริการให้ดียิ่งขึ้น'
          )}
        </div>
      </div>
    );
  if (done === 'answered')
    return (
      <div className="sv-done">
        <div className="ic">✅</div>
        <h2 style={{ marginTop: 10 }}>คุณประเมินเคสนี้แล้ว</h2>
      </div>
    );
  if (done === 'expired')
    return (
      <div className="sv-done">
        <div className="ic">⏱️</div>
        <h2 style={{ marginTop: 10 }}>ลิงก์นี้หมดอายุแล้ว</h2>
        <div className="muted" style={{ marginTop: 8 }}>ติดต่อเราได้ที่ {contact}</div>
      </div>
    );

  return (
    <div className="sv-body">
      <div className="sv-q">{form.scoreQuestion}</div>
      <div className="scale" role="radiogroup" aria-label={form.scoreQuestion}>
        {labels.map((lb, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              className={(score === n ? 'on ' : '') + (score >= n ? 'fill' : '')}
              onClick={() => pick(n)}
            >
              <span className="st">★</span>
              <span className="lb">{lb}</span>
            </button>
          );
        })}
      </div>

      {score > 0 && (
        <>
          <div className="sv-q2">{low ? form.improveQuestion : form.impressQuestion}</div>
          <div className="chips">
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

          <div className="sv-q2">{form.resolvedQuestion}</div>
          <div className="chips">
            {resolvedOptions.map((o) => (
              <button key={o.id} type="button" className={resolved === o.id ? 'on' : ''} aria-pressed={resolved === o.id} onClick={() => setResolved(o.id)}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="sv-q2">{form.commentQuestion}</div>
          <textarea
            className="input"
            rows={3}
            maxLength={commentMax}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="พิมพ์ความเห็นของคุณ"
          />
          <div className="counter">
            {comment.length}/{commentMax}
          </div>
        </>
      )}

      {error && (
        <div className="alert bad" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}

      {score > 0 && (
        <div className="sv-submit">
          <button className="btn primary lg block" onClick={submit} disabled={busy}>
            {busy ? 'กำลังส่ง…' : 'ส่งคำตอบ'}
          </button>
        </div>
      )}

      <div className="sv-pdpa">
        เราเก็บคำตอบนี้เพื่อนำไปปรับปรุงคุณภาพการให้บริการเท่านั้น โดยไม่เก็บชื่อ เบอร์โทร หรืออีเมลของคุณ ·{' '}
        <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
          นโยบายความเป็นส่วนตัว
        </a>
      </div>
    </div>
  );
}
