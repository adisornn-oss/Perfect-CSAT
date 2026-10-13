import { handler, body, json, bad } from '@/lib/http';
import { requireRole, publicUser } from '@/lib/auth';
import { updateUser, listOpenFollowups } from '@/lib/data';
import { checkPassword } from '@/lib/ids';
import { sweep } from '@/lib/sweep';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const u = await requireRole('agent');
  await sweep(req).catch(() => {});
  const open = await listOpenFollowups();
  const mine = u.role === 'agent' ? open.filter((f) => f.assigneeId === u.id) : open;
  return json({ user: publicUser(u), pendingFollowups: mine.filter((f) => f.status === 'pending').length });
});

export const PATCH = handler(async (req) => {
  const u = await requireRole('agent');
  const { currentPassword, newPassword, nickname } = await body(req);
  if (newPassword) {
    if (u.passHash && !checkPassword(currentPassword, u.passHash)) return bad('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    await updateUser(u, u.id, { password: newPassword });
  }
  if (nickname != null) await updateUser(u, u.id, { nickname });
  return json({ ok: true });
});
