import { LOAN_STATUS } from '../constants/loan.constants';
import { isRepaymentPastDue } from './bounce-charge.util';

/**
 * Display / API loan status: ACTIVE loans past maturity (and not closed)
 * are treated as OVERDUE even if the DB row has not been updated yet.
 */
export function resolveEffectiveLoanStatus(input: {
  statusName: string;
  statusDisplayName?: string | null;
  loanMaturityDate: Date;
  closedAt: Date | null | undefined;
  asOf?: Date;
}): { code: string; label: string } {
  const code = input.statusName;
  const label = input.statusDisplayName?.trim() || code;

  if (input.closedAt != null || code === LOAN_STATUS.CLOSED || code === LOAN_STATUS.WRITTEN_OFF) {
    return { code, label };
  }

  if (code === LOAN_STATUS.OVERDUE) {
    return { code: LOAN_STATUS.OVERDUE, label: input.statusDisplayName?.trim() || 'Overdue' };
  }

  if (code === LOAN_STATUS.ACTIVE && isRepaymentPastDue(input.loanMaturityDate, input.asOf)) {
    return { code: LOAN_STATUS.OVERDUE, label: 'Overdue' };
  }

  return { code, label };
}
