import { pageUser, publicUser } from '@/lib/auth';
import { ensureSeed } from '@/lib/data';
import Shell from '@/components/Shell';
import CasesClient from './CasesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perfect CSAT' };

export default async function Page() {
  await ensureSeed();
  const u = publicUser(await pageUser('agent'));
  return (
    <Shell user={u}>
      <CasesClient user={u} />
    </Shell>
  );
}
