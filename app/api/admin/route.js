import { handler, json, body, qs, bad } from '@/lib/http';
import { requireRole, publicUser, atLeast } from '@/lib/auth';
import {
  listUsers, updateUser, getProducts, saveProduct, getSettings, saveSettings, getTemplates, saveTemplate,
  getForm, saveForm, currentFormVersion, listAudit, getClosedCounts, setClosedCount, DEFAULT_TEMPLATES, CHANNELS, ensureSeed,
  createUsers, createLoginToken, getUser,
} from '@/lib/data';
import { listOutbox, channelsConfigured, appUrl, sendEmail } from '@/lib/notify';
import { ym, shiftMonth, monthsBetween } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  await ensureSeed();
  const u = await requireRole('lead');
  const now = ym();
  const months = monthsBetween(shiftMonth(now, -5), now);
  const closed = await getClosedCounts(months);
  const base = { products: await getProducts(true), closed, months };
  if (!atLeast(u, 'admin')) return json({ ...base, role: u.role });
  const ver = await currentFormVersion();
  const forms = [];
  for (let v = ver; v >= Math.max(1, ver - 9); v--) forms.push(await getForm(v));
  return json({
    ...base,
    role: u.role,
    users: (await listUsers()).map(publicUser),
    settings: await getSettings(),
    templates: await getTemplates(),
    defaultTemplates: DEFAULT_TEMPLATES,
    channels: CHANNELS,
    forms,
    audit: await listAudit(200),
    outbox: await listOutbox(50),
    notifyChannels: channelsConfigured(),
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    emailEnabled: Boolean(process.env.RESEND_API_KEY),
  });
});

export const POST = handler(async (req) => {
  const b = await body(req);
  // leads may enter closed-case counts (for the send-ratio KPI); everything else is admin-only
  if (b.action === 'closed') {
    const u = await requireRole('lead');
    return json({ closed: await setClosedCount(u, b.month, b.product, b.count) });
  }
  const u = await requireRole('admin');
  switch (b.action) {
    case 'users.add': {
      // paste many emails → accounts + one-click sign-in links (emailed too when email is configured)
      const { created, skipped } = await createUsers(u, b.emails, b.role || 'agent');
      const base = appUrl(req);
      const invites = [];
      for (const x of created) {
        const link = `${base}/login/link/${await createLoginToken(x)}`;
        const mailed = await sendEmail('คุณได้รับสิทธิ์ใช้งาน Perfect CSAT', `สวัสดีครับ/ค่ะ\n\nคุณได้รับสิทธิ์ใช้งาน Perfect CSAT แล้ว กดลิงก์ด้านล่างเพื่อเข้าสู่ระบบได้ทันที (ไม่ต้องตั้งรหัสผ่าน)\n\n${link}\n\nครั้งต่อไปเข้าที่ ${base} แล้วกด "เข้าสู่ระบบด้วย Google"`, [x.email]).catch(() => 'error');
        invites.push({ email: x.email, link, mailed: mailed === 'sent' });
      }
      return json({ invites, skipped });
    }
    case 'user.link': {
      const target = await getUser(b.id);
      if (!target) return bad('ไม่พบผู้ใช้', 404);
      return json({ link: `${appUrl(req)}/login/link/${await createLoginToken(target)}` });
    }
    case 'user.update':
      if (b.id === u.id && (b.role && b.role !== 'admin' || b.active === false)) return bad('ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตัวเองได้');
      return json({ user: publicUser(await updateUser(u, b.id, b)) });
    case 'product.save':
      return json({ product: await saveProduct(u, b) });
    case 'settings.save':
      return json({ settings: await saveSettings(u, b) });
    case 'template.save':
      return json({ templates: await saveTemplate(u, b.key, b.text) });
    case 'form.save':
      return json({ form: await saveForm(u, b) });
    default:
      return bad('unknown action');
  }
});
