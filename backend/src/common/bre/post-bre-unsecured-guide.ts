import {
  CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS,
  CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS,
} from '../cibil/cibil-tuef.constants';
import { cibilAccountTypeDisplayLabel } from '../cibil/cibil-tradeline.parser';

export type UnsecuredAccountTypeRef = {
  symbol: string;
  label: string;
  exposureBasis: string;
};

export type CreditLimitTierRef = {
  id: number;
  minUnsecuredLoan: number;
  maxUnsecuredLoan: number | null;
  maxBulletLoan: number;
  sortOrder: number;
  isActive: boolean;
};

export type PostBreUnsecuredExposureGuide = {
  /** Runs after bureau pull alongside post-BRE; not a pass/fail post-BRE gate. */
  phaseLabel: string;
  summary: string;
  maxExposureDefinition: string;
  totalExposureDefinition: string;
  tierSelectionRule: string;
  preApprovedFormula: string;
  minLoanAmountInr: number;
  maxLoanAmountInr: number;
  accountTypes: UnsecuredAccountTypeRef[];
  creditLimitTiers: CreditLimitTierRef[];
  relatedToolPath: string;
  configurationPaths: string[];
};

function exposureBasisForSymbol(symbol: string): string {
  if (CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS.has(symbol)) {
    return 'Credit card: GrantedTrade.CreditLimit if > 0, else highBalance → currentBalance → GrantedTrade.CreditLimit';
  }
  return 'Non-card: highBalance → currentBalance → GrantedTrade.CreditLimit (first positive INR amount)';
}

export function buildUnsecuredAccountTypeCatalog(): UnsecuredAccountTypeRef[] {
  return [...CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS]
    .sort()
    .map((symbol) => ({
      symbol,
      label: cibilAccountTypeDisplayLabel(symbol),
      exposureBasis: exposureBasisForSymbol(symbol),
    }));
}


export function buildPostBreUnsecuredExposureGuide(input: {
  creditLimitTiers: CreditLimitTierRef[];
  minLoanAmountInr: number;
  maxLoanAmountInr: number;
}): PostBreUnsecuredExposureGuide {
  return {
    phaseLabel: 'After bureau (pre-approved offer)',
    summary:
      'Total unsecured exposure (open + closed) is both the post-BRE pass/fail gate (MIN_UNSECURED_LOAN_AMOUNT) and, after post-BRE passes, the credit-limit tier lookup / pre-approved bullet loan amount input — the same figure drives both.',
    maxExposureDefinition:
      'maxOpenUnsecuredExposureInr = maximum exposure (INR) among open unsecured tradelines. Inspection only — not used for the offer.',
    totalExposureDefinition:
      'totalUnsecuredExposureInr = sum of exposure on every unsecured tradeline (open and closed). This is used by both MIN_UNSECURED_LOAN_AMOUNT and the credit-limit tier lookup. totalOpenUnsecuredExposureInr (open-only) is inspection-only and no longer drives any gate.',
    tierSelectionRule:
      'First active credit_limit_tier (sortOrder asc) where minUnsecuredLoan ≤ total unsecured exposure ≤ maxUnsecuredLoan (null max = no upper bound).',
    preApprovedFormula:
      'preApprovedAmountInr = clamp(tier.maxBulletLoan, min_loan_amount, max_loan_amount) from eligibility criteria / BRE settings.',
    minLoanAmountInr: input.minLoanAmountInr,
    maxLoanAmountInr: input.maxLoanAmountInr,
    accountTypes: buildUnsecuredAccountTypeCatalog(),
    creditLimitTiers: input.creditLimitTiers,
    relatedToolPath: '/developer-tools/pre-approved-offer',
    configurationPaths: [
      '/eligibility-criteria/credit-limit-eligibility-check',
      '/eligibility-criteria/profile-eligibility-check',
    ],
  };
}
