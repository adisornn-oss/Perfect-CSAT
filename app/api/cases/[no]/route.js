import { handler, json } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { getBundle, getForm } from '@/lib/data';
import { messageFor } from '@/lib/message';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req, { params }) => {
  const u = await requireRole('agent');
  const b = await getBundle(decodeURIComponent(params.no).toUpperCase());
  if (!b || (u.role === 'agent' && b.case.agentId !== u.id)) throw Object.assign(new Error('ไม่พบเคส'), { status: 404 });
  const msg = await messageFor(req, b.case);
  const form = b.resp ? await getForm(b.resp.formVersion) : null;
  return json({ ...b, link: msg.link, message: msg.text, formVersion: form?.version });
});
