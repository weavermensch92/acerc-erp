import './globals.css';
import type { Metadata } from 'next';
import { Noto_Sans_KR, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-noto-sans-kr',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: '폐기물일보 ERP — 에이스알앤씨',
  description: '폐기물 수집운반·처리 일일 운영 관리 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn(notoSansKr.variable, jetBrainsMono.variable)}>
      <body>{children}</body>
    </html>
  );
}
