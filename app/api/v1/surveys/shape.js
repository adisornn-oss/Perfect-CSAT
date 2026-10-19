import { SCORE_LABELS } from '@/lib/data';
import { surveyUrl } from '@/lib/message';

export function shape(req, b) {
  const r = b.resp;
  return {
    caseNo: b.case.no,
    product: b.case.product,
    channel: b.case.channel,
    extRef: b.case.extRef || null,
    link: surveyUrl(req, b.case.token),
    status: b.status,
    createdAt: b.case.createdAt,
    expiresAt: b.case.expiresAt,
    score: r?.score ?? null,
    scoreLabel: r ? SCORE_LABELS[r.score - 1] : null,
    final: Boolean(r?.final),
    resolved: r?.resolved ?? null,
    reasons: r?.reasons || [],
    comment: r?.comment || '',
    answeredAt: r?.answeredAt || null,
    followup: b.fu ? b.fu.status : null,
  };
}
