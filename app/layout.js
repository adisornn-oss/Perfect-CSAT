import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';

const font = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-th',
});

export const metadata = {
  title: 'Perfect CSAT',
  description: 'ระบบประเมินความพึงพอใจลูกค้ารายเคส — Thunder Solution',
  robots: { index: false, follow: false },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#d81b72' };

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
