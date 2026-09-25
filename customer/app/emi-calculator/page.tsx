import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { PersonalLoanEmiCalculator } from '@/components/emi/personal-loan-emi-calculator';

export const metadata: Metadata = {
  title: 'Personal Loan EMI Calculator | CredSolve',
  description:
    'Calculate your monthly EMI instantly. Adjust the loan amount, interest rate, and tenure to see your monthly payment, total interest, and total repayment.',
  openGraph: {
    title: 'Personal Loan EMI Calculator | CredSolve',
    description:
      'Calculate your monthly EMI instantly. Adjust the loan amount, interest rate, and tenure to see your monthly payment, total interest, and total repayment.',
    type: 'website',
  },
};

export default function EmiCalculatorPage() {
  return (
    <LegalPageShell pageLabel="EMI Calculator">
      <h1 className="mb-6 text-2xl font-[700] tracking-tight text-brand-navy sm:text-3xl">
        Personal Loan EMI Calculator
      </h1>
      <Suspense fallback={null}>
        <PersonalLoanEmiCalculator />
      </Suspense>
    </LegalPageShell>
  );
}
