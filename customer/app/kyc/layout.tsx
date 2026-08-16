import localFont from 'next/font/local';
import type { Metadata } from 'next';

const sora = localFont({
  src: '../fonts/Sora-Variable.ttf',
  weight: '100 800',
  variable: '--font-sora',
  display: 'swap',
});

const hanken = localFont({
  src: '../fonts/HankenGrotesk-Variable.ttf',
  weight: '100 900',
  variable: '--font-hanken',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KYC · Verify your identity',
  description: 'Verify your identity with DigiLocker and Aadhaar.',
};

export default function KycLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${sora.variable} ${hanken.variable} w-full`}>{children}</div>;
}
