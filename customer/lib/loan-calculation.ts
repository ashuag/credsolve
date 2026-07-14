import type { LoanCalculationSettingsResponse } from '@/lib/api/eligibility';

export type LoanBreakdown = {
  principal: number;
  interestAmount: number;
  processingFeeAmount: number;
  gstOnProcessing: number;
  totalRepaymentAmount: number;
  totalDisbursementAmount: number;
};

export function computeLoanBreakdown(
  principal: number,
  tenureDays: number,
  settings: Pick<
    LoanCalculationSettingsResponse,
    'roiPerDayPercent' | 'processingFeePercent' | 'processingFeeGstPercent'
  >,
): LoanBreakdown {
  const interestAmount = principal * (settings.roiPerDayPercent / 100) * tenureDays;
  const processingFeeAmount = (principal * settings.processingFeePercent) / 100;
  const gstOnProcessing = (processingFeeAmount * settings.processingFeeGstPercent) / 100;

  return {
    principal,
    interestAmount,
    processingFeeAmount,
    gstOnProcessing,
    totalRepaymentAmount: principal + interestAmount,
    totalDisbursementAmount: principal - processingFeeAmount - gstOnProcessing,
  };
}

export function formatLoanInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRepaymentDateDisplay(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd} / ${mm} / ${yyyy}`;
}
