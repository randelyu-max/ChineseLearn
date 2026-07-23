import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HanziQuest Admin',
  description: 'HanziQuest administration foundation',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
