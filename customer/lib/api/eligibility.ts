import { apiGet } from './client';

export type LoanEligibilityResponse = {
  preApprovedAmountInr: number;
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
