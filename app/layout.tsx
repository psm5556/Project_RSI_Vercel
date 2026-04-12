import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RSI 타겟 가격 계산기',
  description: '현재 RSI와 타겟 RSI 달성에 필요한 가격을 계산합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-app-bg text-gray-200 h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
