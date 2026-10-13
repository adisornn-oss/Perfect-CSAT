// FR-208: QR code of the survey link (for phone / on-site cases).
import QRCode from 'qrcode';
import { requireRole } from '@/lib/auth';
import { getCase } from '@/lib/data';
import { surveyUrl } from '@/lib/message';

export async function GET(req, { params }) {
  try {
    const u = await requireRole('agent');
    const c = await getCase(decodeURIComponent(params.no).toUpperCase());
    if (!c || (u.role === 'agent' && c.agentId !== u.id)) return new Response('not found', { status: 404 });
    const svg = await QRCode.toString(surveyUrl(req, c.token), { type: 'svg', margin: 1, width: 280, errorCorrectionLevel: 'M' });
    return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, max-age=3600' } });
  } catch (e) {
    return new Response(e.message, { status: e.status || 500 });
  }
}
