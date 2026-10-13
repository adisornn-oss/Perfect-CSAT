import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { ensureSeed } from '@/lib/data';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'เข้าสู่ระบบ · Perfect CSAT' };

const ERR = {
  google: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ',
  state: 'เซสชันหมดอายุ กรุณาลองใหม่',
  nouser: 'บัญชี Google นี้ยังไม่ได้รับสิทธิ์ใช้งาน ติดต่อ Admin',
};

export default async function Login({ searchParams }) {
  await ensureSeed();
  if (await currentUser()) redirect('/');
  return (
    <div className="center-page">
      <div className="login">
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img src="/brand-logo.jpg" alt="Perfect CSAT" width={150} height={163} style={{ mixBlendMode: 'multiply' }} />
        </div>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 0 }}>ระบบประเมินความพึงพอใจลูกค้ารายเคส · BoostSMS · EasyCRM</p>
        <LoginForm google={Boolean(process.env.GOOGLE_CLIENT_ID)} error={ERR[searchParams?.e] || ''} />
      </div>
    </div>
  );
}
