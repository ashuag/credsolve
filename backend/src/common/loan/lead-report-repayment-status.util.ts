import { LOAN_STATUS } from '../constants/loan.constants';
import { LOAN_REPAYMENT_STATUS } from '../constants/loan-repayment.constants';

export const LEAD_REPORT_REPAYMENT_STATUS = {
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  PENDING: 'PENDING',
  OVERDUE: 'OVERDUE',
  FAILED: 'FAILED',
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const;

export type LeadReportRepaymentStatus =
  (typeof LEAD_REPORT_REPAYMENT_STATUS)[keyof typeof LEAD_REPORT_REPAYMENT_STATUS];

const LABELS: Record<LeadReportRepaymentStatus, string> = {
  NOT_APPLICABLE: '—',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
  FAILED: 'Failed',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially paid',
  WRITTEN_OFF: 'Written off',
};

/** Pipeline repayment status for LOS Reports → Lead Report. */
export function resolveLeadReportRepaymentStatus(input: {
  hasLoan: boolean;
  loanStatusCode: string | null;
  latestRepaymentStatus: string | null;
}): { code: LeadReportRepaymentStatus; label: string } {
  if (!input.hasLoan || !input.loanStatusCode) {
    return {
      code: LEAD_REPORT_REPAYMENT_STATUS.NOT_APPLICABLE,
      label: LABELS.NOT_APPLICABLE,
    };
  }

  const loan = input.loanStatusCode.toUpperCase();
  if (loan === LOAN_STATUS.WRITTEN_OFF) {
    return {
      code: LEAD_REPORT_REPAYMENT_STATUS.WRITTEN_OFF,
      label: LABELS.WRITTEN_OFF,
    };
  }
  if (loan === LOAN_STATUS.SETTLED) {
    return { code: LEAD_REPORT_REPAYMENT_STATUS.PAID, label: 'Settled' };
  }
  if (loan === LOAN_STATUS.CLOSED) {
    return { code: LEAD_REPORT_REPAYMENT_STATUS.PAID, label: LABELS.PAID };
  }
  if (loan === LOAN_STATUS.OVERDUE) {
    return { code: LEAD_REPORT_REPAYMENT_STATUS.OVERDUE, label: LABELS.OVERDUE };
  }

  const repayment = input.latestRepaymentStatus?.toUpperCase() ?? null;
  if (repayment === LOAN_REPAYMENT_STATUS.FAILED) {
    return { code: LEAD_REPORT_REPAYMENT_STATUS.FAILED, label: LABELS.FAILED };
  }
  if (repayment === LOAN_REPAYMENT_STATUS.PARTIAL) {
    return {
      code: LEAD_REPORT_REPAYMENT_STATUS.PARTIALLY_PAID,
      label: LABELS.PARTIALLY_PAID,
    };
  }
  if (repayment === LOAN_REPAYMENT_STATUS.SUCCESS) {
    return {
      code: LEAD_REPORT_REPAYMENT_STATUS.PARTIALLY_PAID,
      label: LABELS.PARTIALLY_PAID,
    };
  }

  return { code: LEAD_REPORT_REPAYMENT_STATUS.PENDING, label: LABELS.PENDING };
}
