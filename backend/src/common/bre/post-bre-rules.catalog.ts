import { REJECTION_REASON } from '../constants/rejection-reason.constants';

export const POST_BRE_ENQUIRY_WINDOW_DAYS = 30;

export type PostBreThresholdsSnapshot = {
  cibilMinNew: number;
  cibilMinExisting: number;
  settledLookbackMonths: number;
  maxEnquiries30Days: number;
  openDpdMonths: number;
  dpd30PlusMonths: number;
  dpd60PlusMonths: number;
  dpd90PlusMonths: number;
  enforceNoRestructuredLoans: boolean;
  enforceNoSmaPwos: boolean;
  enforceNoActiveMfi: boolean;
};

export type PostBreRuleCatalogEntry = {
  id: string;
  label: string;
  category: 'score' | 'tradeline' | 'enquiry' | 'dpd' | 'diagnostic';
  /** Shown in LOS; does not block overall pass when failed. */
  informationalOnly: boolean;
  /** When false, rule is skipped unless the toggle criterion is enabled. */
  alwaysEvaluated: boolean;
  toggleCriteriaKey: string | null;
  criteriaKeys: string[];
  rejectionReasonCode: string | null;
  condition: string;
  passCondition: string;
  dataSources: string[];
  tuefReference: string | null;
  notes: string | null;
};

export type PostBreRulesCatalog = {
  enquiryWindowDays: number;
  rules: PostBreRuleCatalogEntry[];
};

/** Static rule definitions with live threshold values interpolated. */
export function buildPostBreRulesCatalog(thresholds: PostBreThresholdsSnapshot): PostBreRulesCatalog {
  const rules: PostBreRuleCatalogEntry[] = [
    {
      id: 'bureau_score_present',
      label: 'Bureau score available',
      category: 'diagnostic',
      informationalOnly: true,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [],
      rejectionReasonCode: null,
      condition: 'Borrower.CreditScore.riskScore must be present in the Tenacio / TrueLink bureau payload.',
      passCondition: 'Score parsed successfully from bureau JSON.',
      dataSources: ['TrueLinkCreditReport → Borrower → CreditScore.riskScore'],
      tuefReference: null,
      notes: 'Production skips score-based rules when score is missing; dry-run still reports this check.',
    },
    {
      id: 'new_to_credit',
      label: 'New to credit (NTC)',
      category: 'score',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [],
      rejectionReasonCode: REJECTION_REASON.NEW_TO_CREDIT,
      condition: 'Bureau risk score equals -1 (CIBIL new-to-credit).',
      passCondition: 'Score is any value other than -1.',
      dataSources: ['Borrower.CreditScore.riskScore'],
      tuefReference: null,
      notes: null,
    },
    {
      id: 'cibil_score_minimum',
      label: 'Minimum CIBIL score',
      category: 'score',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: ['cibil_min_new', 'cibil_min_existing'],
      rejectionReasonCode: REJECTION_REASON.CIBIL_SCORE_LOW,
      condition: `New customers: score < ${thresholds.cibilMinNew}. Existing (repeat) customers: score < ${thresholds.cibilMinExisting}.`,
      passCondition: `Score ≥ configured minimum for customer type (new vs existing repeat borrower with a disbursed loan).`,
      dataSources: ['Borrower.CreditScore.riskScore', 'applications (disbursed) for repeat-customer flag'],
      tuefReference: null,
      notes: 'Existing customer = at least one application in DISBURSED status.',
    },
    {
      id: 'adverse_tradeline',
      label: 'No adverse tradeline / settlement',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: ['settled_months'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      condition: `Write-off / settlement amounts reported (non-sentinel) or adverse pay status (DBT, LSS, SUB, SET, etc.) within last ${thresholds.settledLookbackMonths} months.`,
      passCondition: 'No adverse tradeline signals in the lookback window.',
      dataSources: [
        'TradeLinePartition → Tradeline (writtenOffAmtTotal, settlementAmount)',
        'PayStatusHistory → MonthlyPayStatus',
      ],
      tuefReference: 'Payment history / account condition codes',
      notes: null,
    },
    {
      id: 'no_restructured_loans',
      label: 'No restructured loans',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: false,
      toggleCriteriaKey: 'no_restructured_loans',
      criteriaKeys: ['no_restructured_loans'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_RESTRUCTURED_LOAN,
      condition: 'Any tradeline with TUEF Tag 33 Written-off and Settled Status in restructure set (00, 01, 10, 11).',
      passCondition: 'No restructure status on any tradeline.',
      dataSources: ['Tradeline writtenOffSettledStatus', 'GrantedTrade'],
      tuefReference: 'TUEF Tag 33 — codes 00, 01, 10, 11',
      notes: 'Skipped when no_restructured_loans is false.',
    },
    {
      id: 'no_sma_pwos',
      label: 'No SMA or PWOS trade lines',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: false,
      toggleCriteriaKey: 'no_sma_pwos',
      criteriaKeys: ['no_sma_pwos'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_SMA_PWOS_TRADELINE,
      condition: 'SMA, SMA0–SMA2, or PWOS on current pay status, worst pay status, or monthly history.',
      passCondition: 'No SMA / PWOS classification on any tradeline.',
      dataSources: ['PayStatus', 'GrantedTrade.WorstPayStatus', 'MonthlyPayStatus'],
      tuefReference: 'TUEF asset class SMA; PWOS retained for TrueLink feeds',
      notes: 'Skipped when no_sma_pwos is false.',
    },
    {
      id: 'no_active_mfi',
      label: 'No active MFI loans',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: false,
      toggleCriteriaKey: 'no_active_mfi',
      criteriaKeys: ['no_active_mfi'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_ACTIVE_MFI_LOAN,
      condition: 'Open tradeline with MFI account type (40–43) or IndustryCode MFI.',
      passCondition: 'No open microfinance loan tradelines.',
      dataSources: ['TradeLinePartition.accountTypeSymbol', 'Tradeline.IndustryCode', 'open/closed status'],
      tuefReference: 'TUEF Appendix A account types 40–43',
      notes: 'Skipped when no_active_mfi is false.',
    },
    {
      id: 'credit_enquiries',
      label: 'Loan enquiry limit',
      category: 'enquiry',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: ['max_enquiries_30_days'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_ENQUIRIES_EXCEEDED,
      condition: `More than ${thresholds.maxEnquiries30Days} loan-purpose enquiries in the last ${POST_BRE_ENQUIRY_WINDOW_DAYS} days.`,
      passCondition: `Count ≤ ${thresholds.maxEnquiries30Days} within the rolling window.`,
      dataSources: ['InquiryPartition → Inquiry'],
      tuefReference: 'Appendix A enquiry purpose; excludes CC (10), portfolio (90), retro (91)',
      notes: 'Credit-card-only and portfolio enquiry purposes are excluded from the count.',
    },
    {
      id: 'dpd_open_dpd',
      label: 'Open loan DPD',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: ['open_dpd_months'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `Open, loan-related tradeline with DPD > 0 in any month within last ${thresholds.openDpdMonths} months.`,
      passCondition: 'No positive DPD on open loan accounts in window.',
      dataSources: ['PayStatusHistory on loan tradelines (excludes CC 10, telco 18–20)'],
      tuefReference: 'Monthly pay status → DPD days mapping',
      notes:
        'Unsecured personal loans (05, 06, etc.) are included. Credit cards (10) are excluded from this open-DPD check only — see Open unsecured exposure section.',
    },
    {
      id: 'dpd_dpd_30plus',
      label: '30+ DPD',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: ['dpd_30plus_months'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `Any tradeline month with ≥ 30 DPD within last ${thresholds.dpd30PlusMonths} months.`,
      passCondition: 'No 30+ DPD breach in window.',
      dataSources: ['PayStatusHistory → MonthlyPayStatus (all loan-related tradelines)'],
      tuefReference: null,
      notes: null,
    },
    {
      id: 'dpd_dpd_60plus',
      label: '60+ DPD',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: ['dpd_60plus_months'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `Any tradeline month with ≥ 60 DPD within last ${thresholds.dpd60PlusMonths} months.`,
      passCondition: 'No 60+ DPD breach in window.',
      dataSources: ['PayStatusHistory → MonthlyPayStatus'],
      tuefReference: null,
      notes: null,
    },
    {
      id: 'dpd_dpd_90plus',
      label: '90+ DPD',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: ['dpd_90plus_months'],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `Any tradeline month with ≥ 90 DPD within last ${thresholds.dpd90PlusMonths} months.`,
      passCondition: 'No 90+ DPD breach in window.',
      dataSources: ['PayStatusHistory → MonthlyPayStatus'],
      tuefReference: null,
      notes: null,
    },
  ];

  return { enquiryWindowDays: POST_BRE_ENQUIRY_WINDOW_DAYS, rules };
}
