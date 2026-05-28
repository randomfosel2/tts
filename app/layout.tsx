import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: '대모산 호텔 실시간 AI 회의록 시스템',
  description: '실시간 음성 인식(STT) 및 AI 요약 기반 회의록 관리 시스템',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ko" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased text-slate-800 bg-slate-50/50" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

