import { pageUser, publicUser } from '@/lib/auth';
import { ensureSeed } from '@/lib/data';
import Shell from '@/components/Shell';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perfect CSAT' };

export default async function Page() {
  await ensureSeed();
  const u = publicUser(await pageUser('lead'));
  return (
    <Shell user={u}>
      <AdminClient user={u} />
    </Shell>
  );
}
