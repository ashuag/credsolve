import {
  CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS,
  CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS,
} from '../cibil/cibil-account-type.constants';
import { cibilAccountTypeDisplayLabel } from '../cibil/cibil-tradeline.parser';

/** Account types excluded from “open loan DPD” (still in 30/60/90+ DPD windows). */
export const POST_BRE_NON_LOAN_ACCOUNT_TYPES_FOR_OPEN_DPD = ['10', '18', '19', '20'] as const;

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
  openDpdExcludedAccountTypes: Array<{ symbol: string; label: string; reason: string }>;
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

export function buildOpenDpdExcludedAccountTypes(): PostBreUnsecuredExposureGuide['openDpdExcludedAccountTypes'] {
  const reasons: Record<string, string> = {
    '10': 'Credit card — excluded from open-loan DPD only',
    '18': 'Telco — not a loan tradeline',
    '19': 'Telco — not a loan tradeline',
    '20': 'Telco — not a loan tradeline',
  };
  return POST_BRE_NON_LOAN_ACCOUNT_TYPES_FOR_OPEN_DPD.map((symbol) => ({
    symbol,
    label: cibilAccountTypeDisplayLabel(symbol),
    reason: reasons[symbol] ?? 'Excluded from open-loan DPD',
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
      'Open unsecured exposure is not a post-BRE pass/fail rule. It drives credit-limit tier lookup and the pre-approved bullet loan amount after post-BRE passes.',
    maxExposureDefinition:
      'maxOpenUnsecuredExposureInr = maximum exposure (INR) among all open tradelines whose TUEF account type is in the unsecured set (Appendix E). This value selects the credit_limit_tier row.',
    totalExposureDefinition:
      'totalOpenUnsecuredExposureInr = sum of exposure on every open unsecured tradeline (informational; tier uses max only).',
    tierSelectionRule:
      'First active credit_limit_tier (sortOrder asc) where minUnsecuredLoan ≤ max exposure ≤ maxUnsecuredLoan (null max = no upper bound).',
    preApprovedFormula:
      'preApprovedAmountInr = clamp(tier.maxBulletLoan, min_loan_amount, max_loan_amount) from eligibility criteria / BRE settings.',
    minLoanAmountInr: input.minLoanAmountInr,
    maxLoanAmountInr: input.maxLoanAmountInr,
    accountTypes: buildUnsecuredAccountTypeCatalog(),
    openDpdExcludedAccountTypes: buildOpenDpdExcludedAccountTypes(),
    creditLimitTiers: input.creditLimitTiers,
    relatedToolPath: '/developer-tools/pre-approved-offer',
    configurationPaths: [
      '/eligibility-criteria/credit-limit-eligibility-check',
      '/eligibility-criteria/profile-eligibility-check',
    ],
  };
}
