import { resolveEffectiveLoanStatus } from './effective-loan-status.util';

describe('resolveEffectiveLoanStatus', () => {
  const maturity = new Date('2026-07-31T00:00:00.000Z');

  it('keeps CLOSED unchanged', () => {
    expect(
      resolveEffectiveLoanStatus({
        statusName: 'CLOSED',
        statusDisplayName: 'Closed',
        loanMaturityDate: maturity,
        closedAt: new Date('2026-07-20T00:00:00.000Z'),
        asOf: new Date('2026-08-07T10:00:00+05:30'),
      }),
    ).toEqual({ code: 'CLOSED', label: 'Closed' });
  });

  it('maps ACTIVE past maturity to OVERDUE', () => {
    expect(
      resolveEffectiveLoanStatus({
        statusName: 'ACTIVE',
        statusDisplayName: 'Active',
        loanMaturityDate: maturity,
        closedAt: null,
        asOf: new Date('2026-08-07T10:00:00+05:30'),
      }),
    ).toEqual({ code: 'OVERDUE', label: 'Overdue' });
  });

  it('keeps ACTIVE when maturity day has not passed', () => {
    expect(
      resolveEffectiveLoanStatus({
        statusName: 'ACTIVE',
        statusDisplayName: 'Active',
        loanMaturityDate: maturity,
        closedAt: null,
        asOf: new Date('2026-07-31T18:00:00+05:30'),
      }),
    ).toEqual({ code: 'ACTIVE', label: 'Active' });
  });
});
