import { apiGet } from './client';

export type LoanEligibilityResponse = {
  preApprovedAmountInr: number;
};

export type LoanCalculationSettingsResponse = {
  minLoanAmount: number;
  maxLoanAmount: number;
  loanTenureDays: number;
  roiPerDayPercent: number;
  processingFeePercent: number;
  processingFeeGstPercent: number;
};

export async function fetchLoanEligibility(): Promise<LoanEligibilityResponse> {
  const data = await apiGet<LoanEligibilityResponse>(
    '/loans/eligibility',
    'Unable to check loan eligibility.'
  );
  if (!data || typeof data.preApprovedAmountInr !== 'number') {
    throw new Error('Invalid eligibility response.');
  }
  return data;
}

export async function fetchLoanCalculationSettings(): Promise<LoanCalculationSettingsResponse> {
  const data = await apiGet<LoanCalculationSettingsResponse>(
    '/loans/settings',
    'Unable to load loan settings.'
  );
  if (
    !data ||
    typeof data.minLoanAmount !== 'number' ||
    typeof data.maxLoanAmount !== 'number' ||
    typeof data.loanTenureDays !== 'number' ||
    typeof data.roiPerDayPercent !== 'number' ||
    typeof data.processingFeePercent !== 'number' ||
    typeof data.processingFeeGstPercent !== 'number'
  ) {
    throw new Error('Invalid loan settings response.');
  }
  return data;
}
