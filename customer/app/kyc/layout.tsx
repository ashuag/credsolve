import { Hanken_Grotesk, Sora } from 'next/font/google';
import type { Metadata } from 'next';

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hanken',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KYC · Verify your identity',
  description: 'Verify your identity with DigiLocker and Aadhaar.',
};

export default function KycLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${sora.variable} ${hanken.variable} flex h-full min-h-0 flex-1 flex-col`}>{children}</div>;
}
