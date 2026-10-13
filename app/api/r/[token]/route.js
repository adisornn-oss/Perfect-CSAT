// Public survey submit. FR-308: called on star tap (final=false) and on submit (final=true).
import { handler, json, body, bad } from '@/lib/http';
import { caseByToken, saveResponse } from '@/lib/data';
import { TOKEN_RE, ipOf } from '@/lib/ids';
import { limited, over } from '@/lib/ratelimit';
import { alertLowScore } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req, { params }) => {
  const ip = ipOf(req);
  if ((await over('rmiss', ip, 20, 3600)) || (await limited('rsubmit', ip, 30, 600)))
    return bad('ส่งคำตอบบ่อยเกินไป กรุณารอสักครู่', 429);
  if (!TOKEN_RE.test(params.token)) return bad('not found', 404);
  const c = await caseByToken(params.token);
  if (!c) {
    await limited('rmiss', ip, 20, 3600);
    return bad('not found', 404);
  }
  const input = await body(req);
  const { resp, lowScoreEvent } = await saveResponse(c, input, { final: Boolean(input.final) });
  if (lowScoreEvent) {
    // await so the alert is delivered before the serverless function freezes (FR-501: < 5 min)
    try {
      if (lowScoreEvent === 'new' || lowScoreEvent === 'new+final') await alertLowScore(c, resp, 'new', req);
      if (lowScoreEvent === 'final') await alertLowScore(c, resp, 'final', req);
    } catch (e) {
      console.error('alert failed', e);
    }
  }
  return json({ ok: true, score: resp.score, final: resp.final });
});
