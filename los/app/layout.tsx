import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { NavigationProgressProvider } from '@/components/ui/navigation-progress-provider';

export const metadata: Metadata = {
  title: 'MoneyCash LOS',
  description: 'MoneyCash LOS interface'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <NavigationProgressProvider>{children}</NavigationProgressProvider>
      </body>
    </html>
  );
}
