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

const ELIGIBILITY_CACHE_TTL_MS = 60_000;
const SETTINGS_CACHE_TTL_MS = 5 * 60_000;

let eligibilityCache: { data: LoanEligibilityResponse; expiresAt: number } | null = null;
let eligibilityRequest: Promise<LoanEligibilityResponse> | null = null;

let settingsCache: { data: LoanCalculationSettingsResponse; expiresAt: number } | null = null;
let settingsRequest: Promise<LoanCalculationSettingsResponse> | null = null;

function isFresh(expiresAt: number): boolean {
  return Date.now() < expiresAt;
}

export async function fetchLoanEligibility(): Promise<LoanEligibilityResponse> {
  if (eligibilityCache && isFresh(eligibilityCache.expiresAt)) {
    return eligibilityCache.data;
  }

  if (!eligibilityRequest) {
    eligibilityRequest = (async () => {
      const data = await apiGet<LoanEligibilityResponse>(
        '/loans/eligibility',
        'Unable to check loan eligibility.'
      );
      if (!data || typeof data.preApprovedAmountInr !== 'number') {
        throw new Error('Invalid eligibility response.');
      }

      eligibilityCache = {
        data,
        expiresAt: Date.now() + ELIGIBILITY_CACHE_TTL_MS
      };
      return data;
    })().finally(() => {
      eligibilityRequest = null;
    });
  }

  return eligibilityRequest;
}

export async function fetchLoanCalculationSettings(): Promise<LoanCalculationSettingsResponse> {
  if (settingsCache && isFresh(settingsCache.expiresAt)) {
    return settingsCache.data;
  }

  if (!settingsRequest) {
    settingsRequest = (async () => {
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

      settingsCache = {
        data,
        expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS
      };
      return data;
    })().finally(() => {
      settingsRequest = null;
    });
  }

  return settingsRequest;
}
