// "Email me a sign-in link". Always answers the same way so it can't be used to probe accounts.
import { handler, body, json, bad } from '@/lib/http';
import { ensureSeed, getUserByEmail, getSettings, createUser, createLoginToken } from '@/lib/data';
import { ipOf } from '@/lib/ids';
import { limited } from '@/lib/ratelimit';
import { appUrl, sendEmail } from '@/lib/notify';

export const POST = handler(async (req) => {
  await ensureSeed();
  if (!process.env.RESEND_API_KEY) return bad('ยังไม่ได้ตั้งค่าการส่งอีเมล ใช้ Google หรือขอลิงก์จาก Admin', 400);
  if (await limited('magic', ipOf(req), 5, 900)) return bad('ขอบ่อยเกินไป รอ 15 นาทีแล้วลองใหม่', 429);
  const email = String((await body(req)).email || '').trim().toLowerCase();
  let u = await getUserByEmail(email);
  if (!u) {
    const s = await getSettings();
    if (s.autoJoinDomain && email.endsWith(`@${s.autoJoinDomain}`)) u = await createUser(null, { email, role: s.autoJoinRole, via: 'email-auto' });
  }
  if (u && u.active !== false) {
    const link = `${appUrl(req)}/login/link/${await createLoginToken(u)}`;
    await sendEmail('ลิงก์เข้าสู่ระบบ Perfect CSAT', `กดลิงก์ด้านล่างเพื่อเข้าสู่ระบบ Perfect CSAT (ใช้ได้ 1 ครั้ง ภายใน 7 วัน)\n\n${link}\n\nหากคุณไม่ได้ขอลิงก์นี้ ไม่ต้องทำอะไร`, [u.email]);
  }
  return json({ ok: true });
});
