import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { ensureSeed } from '@/lib/data';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'เข้าสู่ระบบ · Perfect CSAT' };

const ERR = {
  google: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง',
  state: 'หน้าเข้าสู่ระบบหมดเวลา ลองอีกครั้ง',
  nouser: 'บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อ Admin ให้เพิ่มอีเมลของคุณ',
  disabled: 'บัญชีนี้ถูกปิดการใช้งาน',
  link: 'ลิงก์นี้ถูกใช้ไปแล้วหรือหมดอายุ ขอลิงก์ใหม่จาก Admin หรือเข้าด้วย Google',
};

export default async function Login({ searchParams }) {
  await ensureSeed();
  if (await currentUser()) redirect('/');
  return (
    <div className="auth">
      <div className="auth-box">
        <img src="/brand-logo.jpg" alt="Perfect CSAT" width={92} height={100} style={{ mixBlendMode: 'multiply', display: 'block', marginBottom: 22 }} />
        <h1>เข้าสู่ระบบ</h1>
        <p className="soft small" style={{ margin: '4px 0 22px' }}>สำหรับทีม Customer Support · Thunder Solution · EasySlip · BoostSMS · EasyCRM</p>
        <LoginForm
          google={Boolean(process.env.GOOGLE_CLIENT_ID)}
          email={Boolean(process.env.RESEND_API_KEY)}
          domain={process.env.GOOGLE_HD || 'thunder.in.th'}
          error={ERR[searchParams?.e] || ''}
        />
      </div>
    </div>
  );
}
