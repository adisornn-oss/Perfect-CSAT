import { headers } from 'next/headers';
import { caseByToken, markOpened, getProduct, getForm, getResponse, getSettings, SCORE_LABELS, RESOLVED, COMMENT_MAX } from '@/lib/data';
import { TOKEN_RE } from '@/lib/ids';
import { limited, over } from '@/lib/ratelimit';
import { fmt } from '@/lib/time';
import Survey from './Survey';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'แบบประเมินความพึงพอใจ', robots: { index: false, follow: false } };

function Shell({ product, children }) {
  return (
    <main className="sv" style={product ? { '--pc': product.color } : undefined}>
      <div className="sv-card">{children}</div>
      <div className="sv-foot">
        <img src="/brand-mark.jpg" alt="" style={{ mixBlendMode: 'multiply' }} /> ขับเคลื่อนโดย Perfect CSAT
      </div>
    </main>
  );
}

function Head({ product, c }) {
  return (
    <div className="sv-head">
      {product?.logo ? <img src={product.logo} alt={product.name} /> : <h2 style={{ color: product?.color }}>{product?.name}</h2>}
      {c && (
        <div className="sv-meta">
          เคส <b className="mono">{c.no}</b> · ดูแลโดย <b>{c.agentNick}</b>
        </div>
      )}
    </div>
  );
}

function Message({ icon, title, children }) {
  return (
    <div className="sv-done">
      <div className="ic">{icon}</div>
      <h2 style={{ marginTop: 10 }}>{title}</h2>
      <div className="muted" style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export default async function SurveyPage({ params }) {
  const h = headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const notFound = (
    <Shell>
      <Message icon="🔍" title="ไม่พบแบบประเมินนี้">กรุณาตรวจสอบลิงก์อีกครั้ง หรือติดต่อทีมซัพพอร์ตที่ส่งลิงก์ให้คุณ</Message>
    </Shell>
  );

  // NFR-01: throttle per IP, and block IPs that keep hitting unknown tokens (link guessing)
  if ((await over('rmiss', ip, 20, 3600)) || (await limited('rview', ip, 60, 600))) return notFound;
  const tok = params.token;
  const c = TOKEN_RE.test(tok) ? await caseByToken(tok) : null;
  if (!c) {
    await limited('rmiss', ip, 20, 3600);
    return notFound;
  }

  const [product, resp, settings] = await Promise.all([getProduct(c.product), getResponse(c.no), getSettings()]);

  if (resp?.final) {
    return (
      <Shell product={product}>
        <Head product={product} c={c} />
        <Message icon="✅" title="คุณประเมินเคสนี้แล้ว">ขอบคุณสำหรับความคิดเห็น ทีมงานได้รับคำตอบของคุณเรียบร้อยแล้ว</Message>
      </Shell>
    );
  }
  if (Date.now() > new Date(c.expiresAt).getTime()) {
    return (
      <Shell product={product}>
        <Head product={product} c={c} />
        <Message icon="⏱️" title="ลิงก์นี้หมดอายุแล้ว">
          ลิงก์ประเมินใช้ได้ถึง {fmt(c.expiresAt)}
          <br />
          หากต้องการแจ้งความเห็นหรือยังมีปัญหา ติดต่อเราได้ที่
          <br />
          <b style={{ color: 'var(--ink)' }}>{product?.contact}</b>
        </Message>
      </Shell>
    );
  }

  await markOpened(c);
  const form = await getForm(resp?.formVersion);

  return (
    <Shell product={product}>
      <Head product={product} c={c} />
      <Survey
        token={tok}
        initialScore={resp?.score || 0}
        form={{
          scoreQuestion: form.scoreQuestion,
          improveQuestion: form.improveQuestion,
          improveOptions: form.improveOptions,
          impressQuestion: form.impressQuestion,
          impressOptions: form.impressOptions,
          resolvedQuestion: form.resolvedQuestion,
          commentQuestion: form.commentQuestion,
        }}
        labels={SCORE_LABELS}
        resolvedOptions={RESOLVED}
        commentMax={COMMENT_MAX}
        privacyUrl={settings.privacyUrl}
        contact={product?.contact || ''}
      />
    </Shell>
  );
}
