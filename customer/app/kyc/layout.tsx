import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Complete KYC | MoneyCash',
  description: 'Verify with DigiLocker or complete CKYC with document upload.',
};

export default function KycLayout({ children }: { children: React.ReactNode }) {
  return children;
}
