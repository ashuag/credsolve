import { resolveTransactionReportMetrics } from './transaction-report.util';

describe('resolveTransactionReportMetrics', () => {
  const disbursedAt = new Date('2026-07-13T06:00:00.000Z');
  const dueDate = new Date('2026-07-31T00:00:00.000Z');

  it('returns zero interest and no delay when unpaid and still within term', () => {
    expect(
      resolveTransactionReportMetrics({
        disbursedAt,
        dueDate,
        principal: 10_000,
        interestRatePerDay: 0.1,
        repaymentAt: null,
        asOf: new Date('2026-07-20T12:00:00.000Z'),
      }),
    ).toEqual({ interestReceived: 0, daysExceeded: 0 });
  });

  it('counts IST days past due for an unpaid overdue loan', () => {
    expect(
      resolveTransactionReportMetrics({
        disbursedAt,
        dueDate,
        principal: 10_000,
        interestRatePerDay: 0.1,
        repaymentAt: null,
        asOf: new Date('2026-08-05T06:30:00.000Z'),
      }),
    ).toEqual({ interestReceived: 0, daysExceeded: 5 });
  });

  it('accrues interest through the repayment date and records late days', () => {
    const repaymentAt = new Date('2026-08-05T10:00:00.000Z');
    const result = resolveTransactionReportMetrics({
      disbursedAt,
      dueDate,
      principal: 10_000,
      interestRatePerDay: 0.1,
      repaymentAt,
    });
    // 13 Jul → 5 Aug inclusive = 24 days; 10000 × 0.1% × 24 = 240.
    expect(result.interestReceived).toBe(240);
    expect(result.daysExceeded).toBe(5);
  });

  it('does not charge delay when repaid on the due date', () => {
    const result = resolveTransactionReportMetrics({
      disbursedAt,
      dueDate,
      principal: 5_000,
      interestRatePerDay: 0.2,
      repaymentAt: new Date('2026-07-31T18:00:00.000Z'),
    });
    expect(result.daysExceeded).toBe(0);
    expect(result.interestReceived).toBeGreaterThan(0);
  });
});
