import { ELIGIBILITY_CRITERIA as EC } from '../constants/eligibility-criteria.constants';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';

export const POST_BRE_ENQUIRY_WINDOW_DAYS = 30;

export type PostBreThresholdsSnapshot = {
  /** Null when the eligibility criterion is inactive / not loaded. */
  cibilMinNew: number | null;
  cibilMinExisting: number | null;
  settledLookbackMonths: number | null;
  maxEnquiries30Days: number | null;
  openDpdMonths: number | null;
  dpd30PlusMonths: number | null;
  dpd60PlusMonths: number | null;
  dpd90PlusMonths: number | null;
  enforceNoRestructuredLoans: boolean | null;
  enforceNoSmaPwos: boolean | null;
  enforceNoActiveMfi: boolean | null;
  maxMissedPayments6Months: number | null;
  minUnsecuredLoanAmount: number | null;
  rejectedCreditAssessmentGrades: string[] | null;
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

function isCriteriaLoaded(key: string, thresholds: PostBreThresholdsSnapshot): boolean {
  switch (key) {
    case EC.CIBIL_MIN_NEW:
      return thresholds.cibilMinNew != null;
    case EC.CIBIL_MIN_EXISTING:
      return thresholds.cibilMinExisting != null;
    case EC.SETTLED_MONTHS:
      return thresholds.settledLookbackMonths != null;
    case EC.MAX_ENQUIRIES_30_DAYS:
      return thresholds.maxEnquiries30Days != null;
    case EC.OPEN_DPD_MONTHS:
      return thresholds.openDpdMonths != null;
    case EC.DPD_30PLUS_MONTHS:
      return thresholds.dpd30PlusMonths != null;
    case EC.DPD_60PLUS_MONTHS:
      return thresholds.dpd60PlusMonths != null;
    case EC.DPD_90PLUS_MONTHS:
      return thresholds.dpd90PlusMonths != null;
    case EC.MAX_MISSED_PAYMENTS_6_MONTHS:
      return thresholds.maxMissedPayments6Months != null;
    case EC.MIN_UNSECURED_LOAN_AMOUNT:
      return thresholds.minUnsecuredLoanAmount != null;
    case EC.REJECTED_CREDIT_ASSESSMENT_GRADES:
      return thresholds.rejectedCreditAssessmentGrades != null;
    case EC.NO_RESTRUCTURED_LOANS:
      return thresholds.enforceNoRestructuredLoans != null;
    case EC.NO_SMA_PWOS:
      return thresholds.enforceNoSmaPwos != null;
    case EC.NO_ACTIVE_MFI:
      return thresholds.enforceNoActiveMfi != null;
    default:
      return true;
  }
}

/** Static rule definitions with live threshold values interpolated. Inactive criteria are omitted. */
export function buildPostBreRulesCatalog(thresholds: PostBreThresholdsSnapshot): PostBreRulesCatalog {
  const allRules: PostBreRuleCatalogEntry[] = [
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
      condition: 'Bureau risk score equals 0 or -1 (CIBIL new-to-credit).',
      passCondition: 'Score is any value other than 0 or -1.',
      dataSources: ['Borrower.CreditScore.riskScore'],
      tuefReference: null,
      notes: null,
    },
    {
      id: 'bureau_phone_match',
      label: 'Applicant phone matches bureau report',
      category: 'diagnostic',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [],
      rejectionReasonCode: REJECTION_REASON.BUREAU_PHONE_MISMATCH,
      condition:
        'Applicant mobile (customer.mobile_number) does not match any BorrowerTelephone.PhoneNumber on the bureau report (last-10-digit compare after stripping +91 / leading 0 / non-digits).',
      passCondition:
        'At least one bureau phone matches the applicant mobile, or either side has no usable phone data (skipped).',
      dataSources: [
        'customer.mobile_number',
        'TrueLinkCreditReport → Borrower → BorrowerTelephone → PhoneNumber.Number',
      ],
      tuefReference: 'Borrower telephone segment (PhoneType 01/02/03)',
      notes:
        'Production always evaluates after bureau pull. Dry-run evaluates when applicantMobile is supplied; otherwise reports skipped.',
    },
    {
      id: EC.CIBIL_MIN_NEW,
      label: 'Minimum CIBIL score (new customer)',
      category: 'score',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.CIBIL_MIN_NEW],
      rejectionReasonCode: REJECTION_REASON.CIBIL_SCORE_LOW,
      condition: `New customers: score < ${thresholds.cibilMinNew}.`,
      passCondition: `Score ≥ ${thresholds.cibilMinNew} for new customers.`,
      dataSources: ['Borrower.CreditScore.riskScore', 'applications (disbursed) for repeat-customer flag'],
      tuefReference: null,
      notes: 'Applied when the customer has no prior disbursed loan.',
    },
    {
      id: EC.CIBIL_MIN_EXISTING,
      label: 'Minimum CIBIL score (existing customer)',
      category: 'score',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.CIBIL_MIN_EXISTING],
      rejectionReasonCode: REJECTION_REASON.CIBIL_SCORE_LOW,
      condition: `Existing (repeat) customers: score < ${thresholds.cibilMinExisting}.`,
      passCondition: `Score ≥ ${thresholds.cibilMinExisting} for existing customers.`,
      dataSources: ['Borrower.CreditScore.riskScore', 'applications (disbursed) for repeat-customer flag'],
      tuefReference: null,
      notes: 'Applied when the customer has at least one application in DISBURSED status.',
    },
    {
      id: EC.SETTLED_MONTHS,
      label: 'No Doubtful / Loss / Written-off / Settled / Suit Filed',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.SETTLED_MONTHS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      condition: `No DBT, LSS, SUB, SET, 90+ DPD, suit filed / wilful default, write-off / settlement amounts, or TUEF Tag 33 written-off / settled status within last ${thresholds.settledLookbackMonths} months.`,
      passCondition: 'No doubtful / loss / written-off / settled / suit-filed signals in the lookback window.',
      dataSources: [
        'TradeLinePartition → Tradeline (writtenOffAmtTotal, settlementAmount, WrittenOffSettledStatus, SuitFiled)',
        'PayStatusHistory → MonthlyPayStatus (DBT, LSS, SUB, SET, numeric 90+ DPD)',
        'PayStatus, GrantedTrade.WorstPayStatus, AccountCondition',
      ],
      tuefReference: 'Payment history / account condition codes',
      notes: null,
    },
    {
      id: EC.NO_RESTRUCTURED_LOANS,
      label: 'No restructured loans',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: false,
      toggleCriteriaKey: EC.NO_RESTRUCTURED_LOANS,
      criteriaKeys: [EC.NO_RESTRUCTURED_LOANS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_RESTRUCTURED_LOAN,
      condition: 'Any tradeline with TUEF Tag 33 Written-off and Settled Status in restructure set (00, 01, 10, 11).',
      passCondition: 'No restructure status on any tradeline.',
      dataSources: ['Tradeline writtenOffSettledStatus', 'GrantedTrade'],
      tuefReference: 'TUEF Tag 33 — codes 00, 01, 10, 11',
      notes: 'Skipped when no_restructured_loans is false.',
    },
    {
      id: EC.NO_SMA_PWOS,
      label: 'No SMA or PWOS trade lines',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: false,
      toggleCriteriaKey: EC.NO_SMA_PWOS,
      criteriaKeys: [EC.NO_SMA_PWOS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_SMA_PWOS_TRADELINE,
      condition: 'SMA, SMA0–SMA2, or PWOS on current pay status, worst pay status, or monthly history.',
      passCondition: 'No SMA / PWOS classification on any tradeline.',
      dataSources: ['PayStatus', 'GrantedTrade.WorstPayStatus', 'MonthlyPayStatus'],
      tuefReference: 'TUEF asset class SMA; PWOS retained for TrueLink feeds',
      notes: 'Skipped when no_sma_pwos is false.',
    },
    {
      id: EC.NO_ACTIVE_MFI,
      label: 'No active MFI / microfinance loans',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: false,
      toggleCriteriaKey: EC.NO_ACTIVE_MFI,
      criteriaKeys: [EC.NO_ACTIVE_MFI],
      rejectionReasonCode: REJECTION_REASON.BUREAU_ACTIVE_MFI_LOAN,
      condition: 'Open tradeline with MFI account type (40–43), GrantedTrade account type, IndustryCode MFI, or microfinance account label.',
      passCondition: 'No open microfinance loan tradelines.',
      dataSources: ['TradeLinePartition.accountTypeSymbol', 'Tradeline.IndustryCode', 'open/closed status'],
      tuefReference: 'TUEF Appendix A account types 40–43',
      notes: 'Skipped when no_active_mfi is false.',
    },
    {
      id: EC.MAX_ENQUIRIES_30_DAYS,
      label: 'Loan enquiry limit',
      category: 'enquiry',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.MAX_ENQUIRIES_30_DAYS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_ENQUIRIES_EXCEEDED,
      condition: `More than ${thresholds.maxEnquiries30Days} loan-purpose enquiries in the last ${POST_BRE_ENQUIRY_WINDOW_DAYS} days.`,
      passCondition: `Count ≤ ${thresholds.maxEnquiries30Days} within the rolling window.`,
      dataSources: ['InquiryPartition → Inquiry'],
      tuefReference: 'Appendix A enquiry purpose; excludes CC (10), portfolio (90), retro (91)',
      notes: 'Credit-card-only and portfolio enquiry purposes are excluded from the count.',
    },
    {
      id: EC.OPEN_DPD_MONTHS,
      label: 'Open loan DPD',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.OPEN_DPD_MONTHS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `Open, loan-related tradeline with DPD > 0 in any month within last ${thresholds.openDpdMonths} months.`,
      passCondition: 'No positive DPD on open loan accounts in window.',
      dataSources: ['PayStatusHistory on loan tradelines (excludes CC 10, telco 18–20)'],
      tuefReference: 'Monthly pay status → DPD days mapping',
      notes:
        'Unsecured personal loans (05, 06, etc.) are included. Credit cards (10) are excluded from this open-DPD check only — see Open unsecured exposure section.',
    },
    {
      id: EC.DPD_30PLUS_MONTHS,
      label: '30+ DPD',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.DPD_30PLUS_MONTHS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `Any tradeline month with ≥ 30 DPD within last ${thresholds.dpd30PlusMonths} months.`,
      passCondition: 'No 30+ DPD breach in window.',
      dataSources: ['PayStatusHistory → MonthlyPayStatus (all loan-related tradelines)'],
      tuefReference: null,
      notes: null,
    },
    {
      id: EC.DPD_60PLUS_MONTHS,
      label: '60+ DPD',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.DPD_60PLUS_MONTHS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `Any tradeline month with ≥ 60 DPD within last ${thresholds.dpd60PlusMonths} months.`,
      passCondition: 'No 60+ DPD breach in window.',
      dataSources: ['PayStatusHistory → MonthlyPayStatus'],
      tuefReference: null,
      notes: null,
    },
    {
      id: EC.DPD_90PLUS_MONTHS,
      label: '90+ DPD',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.DPD_90PLUS_MONTHS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `Any tradeline month with ≥ 90 DPD within last ${thresholds.dpd90PlusMonths} months.`,
      passCondition: 'No 90+ DPD breach in window.',
      dataSources: ['PayStatusHistory → MonthlyPayStatus'],
      tuefReference: null,
      notes: null,
    },
    {
      id: EC.MAX_MISSED_PAYMENTS_6_MONTHS,
      label: 'Missed payments in last 6 months',
      category: 'dpd',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.MAX_MISSED_PAYMENTS_6_MONTHS],
      rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      condition: `More than ${thresholds.maxMissedPayments6Months} (tradeline × month) instances of DPD > 0 in the last 6 months.`,
      passCondition: `≤ ${thresholds.maxMissedPayments6Months} missed payment(s) across all tradelines in the 6-month window.`,
      dataSources: ['PayStatusHistory → MonthlyPayStatus (all tradelines)'],
      tuefReference: null,
      notes: 'Counts every (tradeline, month) pair with any positive DPD. Threshold is the maximum allowed count.',
    },
    {
      id: EC.MIN_UNSECURED_LOAN_AMOUNT,
      label: 'Minimum total unsecured loan amount',
      category: 'tradeline',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.MIN_UNSECURED_LOAN_AMOUNT],
      rejectionReasonCode: REJECTION_REASON.MIN_UNSECURED_LOAN_AMOUNT_FAILED,
      condition: `Total unsecured tradeline exposure < ₹${thresholds.minUnsecuredLoanAmount}.`,
      passCondition: `Sum of unsecured exposure (open + closed) ≥ ₹${thresholds.minUnsecuredLoanAmount}.`,
      dataSources: [
        'TradeLinePartition → Tradeline (unsecured TUEF Appendix E types, open and closed)',
        'highBalance / currentBalance / GrantedTrade.CreditLimit',
      ],
      tuefReference: 'Appendix E unsecured account types',
      notes:
        'Uses totalUnsecuredExposureInr (sum of every unsecured tradeline, open and closed) — the same figure the pre-approved offer/credit-limit tier lookup uses.',
    },
    {
      id: EC.REJECTED_CREDIT_ASSESSMENT_GRADES,
      label: 'Rejected credit assessment grades',
      category: 'score',
      informationalOnly: false,
      alwaysEvaluated: true,
      toggleCriteriaKey: null,
      criteriaKeys: [EC.REJECTED_CREDIT_ASSESSMENT_GRADES],
      rejectionReasonCode: REJECTION_REASON.CREDIT_ASSESSMENT_GRADE_FAILED,
      condition: `Credit assessment grade is one of ${(thresholds.rejectedCreditAssessmentGrades ?? []).join(', ') || '—'}.`,
      passCondition: `Grade is not in the rejected set (${(thresholds.rejectedCreditAssessmentGrades ?? []).join(', ') || 'none'}).`,
      dataSources: [
        'CIBIL credit-assessment category (loan-count bands A–H)',
        'TradeLinePartition → Tradeline count',
      ],
      tuefReference: null,
      notes: 'Same category as the Credit Assessment panel (A best … H worst). Default blocked grades: E, F, G, H.',
    },
  ];

  return {
    enquiryWindowDays: POST_BRE_ENQUIRY_WINDOW_DAYS,
    rules: allRules.filter((rule) => rule.criteriaKeys.every((key) => isCriteriaLoaded(key, thresholds))),
  };
}
