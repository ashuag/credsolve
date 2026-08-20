import { resolveLeadReportRepaymentStatus } from './lead-report-repayment-status.util';

describe('resolveLeadReportRepaymentStatus', () => {
  it('returns not applicable when there is no loan', () => {
    expect(
      resolveLeadReportRepaymentStatus({
        hasLoan: false,
        loanStatusCode: null,
        latestRepaymentStatus: null,
      }),
    ).toEqual({ code: 'NOT_APPLICABLE', label: '—' });
  });

  it('maps a closed loan to paid', () => {
    expect(
      resolveLeadReportRepaymentStatus({
        hasLoan: true,
        loanStatusCode: 'CLOSED',
        latestRepaymentStatus: 'SUCCESS',
      }),
    ).toEqual({ code: 'PAID', label: 'Paid' });
  });

  it('maps written-off ahead of repayment events', () => {
    expect(
      resolveLeadReportRepaymentStatus({
        hasLoan: true,
        loanStatusCode: 'WRITTEN_OFF',
        latestRepaymentStatus: 'FAILED',
      }),
    ).toEqual({ code: 'WRITTEN_OFF', label: 'Written off' });
  });

  it('maps overdue ahead of a failed repayment attempt', () => {
    expect(
      resolveLeadReportRepaymentStatus({
        hasLoan: true,
        loanStatusCode: 'OVERDUE',
        latestRepaymentStatus: 'FAILED',
      }),
    ).toEqual({ code: 'OVERDUE', label: 'Overdue' });
  });

  it('maps a failed attempt on an active loan', () => {
    expect(
      resolveLeadReportRepaymentStatus({
        hasLoan: true,
        loanStatusCode: 'ACTIVE',
        latestRepaymentStatus: 'FAILED',
      }),
    ).toEqual({ code: 'FAILED', label: 'Failed' });
  });

  it('maps a successful repayment on an active loan to paid', () => {
    expect(
      resolveLeadReportRepaymentStatus({
        hasLoan: true,
        loanStatusCode: 'ACTIVE',
        latestRepaymentStatus: 'SUCCESS',
      }),
    ).toEqual({ code: 'PAID', label: 'Paid' });
  });

  it('maps an active loan with no repayment as pending', () => {
    expect(
      resolveLeadReportRepaymentStatus({
        hasLoan: true,
        loanStatusCode: 'ACTIVE',
        latestRepaymentStatus: null,
      }),
    ).toEqual({ code: 'PENDING', label: 'Pending' });
  });
});
