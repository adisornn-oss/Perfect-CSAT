import { headers } from 'next/headers';
import { caseByToken, markOpened, getProduct, getForm, getResponse, getSettings, SCORE_LABELS, RESOLVED, COMMENT_MAX } from '@/lib/data';
import { TOKEN_RE } from '@/lib/ids';
import { limited, over } from '@/lib/ratelimit';
import { fmt } from '@/lib/time';
import Survey from './Survey';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'แบบประเมินความพึงพอใจ', robots: { index: false, follow: false } };

const ICONS = {
  check: <path d="M20 6 9 17l-5-5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
};

function Shell({ product, children }) {
  return (
    <main className="sv" style={product ? { '--pc': product.color } : undefined}>
      <div className="sv-wrap">{children}</div>
      <div className="sv-foot">
        <img src="/brand-mark.jpg" alt="" /> ขับเคลื่อนโดย Perfect CSAT
      </div>
    </main>
  );
}

function Head({ product, c }) {
  return (
    <div className="sv-top">
      {product?.logo ? <img src={product.logo} alt={product.name} /> : <b style={{ color: product?.color }}>{product?.name}</b>}
      {c && (
        <div className="meta">
          {product?.brand && product.brand !== product.name && (
            <>
              <b>{product.name}</b>
              <br />
            </>
          )}
          เคส <b className="mono">{c.no}</b>
          <br />
          ดูแลโดย <b>{c.agentNick}</b>
        </div>
      )}
    </div>
  );
}

function Message({ icon, title, children }) {
  return (
    <div className="sv-msg">
      <div className="ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[icon]}
        </svg>
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

export default async function SurveyPage({ params, searchParams }) {
  const h = headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const notFound = (
    <Shell>
      <Message icon="search" title="ไม่พบแบบประเมินนี้">ลิงก์อาจพิมพ์ไม่ครบ ลองเปิดจากข้อความที่ทีมซัพพอร์ตส่งให้อีกครั้ง</Message>
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
        <Message icon="check" title="คุณประเมินเคสนี้แล้ว">ทีมงานได้รับคำตอบของคุณแล้ว ขอบคุณที่สละเวลาค่ะ</Message>
      </Shell>
    );
  }
  if (Date.now() > new Date(c.expiresAt).getTime()) {
    return (
      <Shell product={product}>
        <Head product={product} c={c} />
        <Message icon="clock" title="ลิงก์นี้หมดอายุแล้ว">
          แบบประเมินเปิดรับถึง {fmt(c.expiresAt)} หากยังมีปัญหาหรืออยากบอกอะไรเรา ติดต่อได้ที่
          <br />
          <b style={{ color: 'var(--ink)', fontWeight: 500 }}>{product?.contact}</b>
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
        preset={/^[1-5]$/.test(searchParams?.s || '') ? Number(searchParams.s) : 0}
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
