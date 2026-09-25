import './globals.css';
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { ReactNode } from 'react';
import { NavigationProgressProvider } from '@/components/ui/navigation-progress-provider';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CredSolve LOS',
  description: 'CredSolve loan operations'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body suppressHydrationWarning className={poppins.className}>
        <NavigationProgressProvider>{children}</NavigationProgressProvider>
      </body>
    </html>
  );
}
