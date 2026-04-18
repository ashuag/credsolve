import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Pre-approved loan',
  description: 'Your pre-approved loan amount on MoneyCash.',
};

export default function PreApprovedLoanLayout({ children }: { children: ReactNode }) {
  return children;
}
