import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PDF QR Studio — Bezstratny edytor wielostronicowych dokumentów PDF A5',
  description: 'Statyczna aplikacja webowa do precyzyjnego przeglądania i bezstratnego dodawania kodów QR do wielostronicowych dokumentów PDF (A5, do 1500 stron).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className="dark">
      <body className="antialiased h-screen w-screen overflow-hidden flex flex-col">
        {children}
      </body>
    </html>
  );
}
