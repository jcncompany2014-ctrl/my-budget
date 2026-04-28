import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ModeProvider } from '@/components/ModeProvider';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: '가계부',
  description: '간단하게 쓰는 나의 가계부',
  appleWebApp: {
    capable: true,
    title: '가계부',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#00B956',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <ThemeProvider>
          <ModeProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </ModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
