import {
  completedAgeYearsIst,
  computeAmountDueNowInr,
  computeInterestAmountInr,
  computeTenureDays,
  resolveContractedTenureDays,
} from './loan-calculation.util';

describe('computeAmountDueNowInr cooling period', () => {
  const disbursedAt = new Date('2026-07-13T06:00:00.000Z');
  const maturity = new Date('2026-07-31T00:00:00.000Z');
  const tenureDays = computeTenureDays(disbursedAt, maturity); // 19
  const principal = 10_000;
  const dailyRate = 1; // 1% per day for easy math

  it('charges actual days when repaid within the cooling period', () => {
    const due = computeAmountDueNowInr(principal, dailyRate, disbursedAt, {
      asOf: new Date('2026-07-15T10:00:00.000Z'),
      coolingPeriodDays: 7,
      tenureDays,
    });
    // 13 Jul → 15 Jul inclusive = 3 days
    expect(due.daysOutstanding).toBe(3);
    expect(due.interestDays).toBe(3);
    expect(due.usedFullTenureInterest).toBe(false);
    expect(due.interestAmount).toBe(computeInterestAmountInr(principal, dailyRate, 3));
    expect(due.overdueInterestAmount).toBe(0);
    expect(due.totalInterestAmount).toBe(due.interestAmount);
    expect(due.amountDue).toBe(principal + due.interestAmount);
  });

  it('charges full tenure interest after the cooling period', () => {
    const due = computeAmountDueNowInr(principal, dailyRate, disbursedAt, {
      asOf: new Date('2026-07-21T10:00:00.000Z'),
      coolingPeriodDays: 7,
      tenureDays,
    });
    // 13 Jul → 21 Jul inclusive = 9 days, cooling is 7
    expect(due.daysOutstanding).toBe(9);
    expect(due.interestDays).toBe(tenureDays);
    expect(due.usedFullTenureInterest).toBe(true);
    expect(due.interestAmount).toBe(computeInterestAmountInr(principal, dailyRate, tenureDays));
  });

  it('treats the last cooling day as actual-day interest', () => {
    const due = computeAmountDueNowInr(principal, dailyRate, disbursedAt, {
      asOf: new Date('2026-07-19T10:00:00.000Z'),
      coolingPeriodDays: 7,
      tenureDays,
    });
    // 13 Jul → 19 Jul inclusive = 7 days
    expect(due.daysOutstanding).toBe(7);
    expect(due.interestDays).toBe(7);
    expect(due.usedFullTenureInterest).toBe(false);
  });

  it('always charges full tenure when cooling period is 0', () => {
    const due = computeAmountDueNowInr(principal, dailyRate, disbursedAt, {
      asOf: new Date('2026-07-13T12:00:00.000Z'),
      coolingPeriodDays: 0,
      tenureDays,
    });
    expect(due.daysOutstanding).toBe(1);
    expect(due.usedFullTenureInterest).toBe(true);
    expect(due.interestDays).toBe(tenureDays);
  });

  it('adds overdue-days interest on top of full tenure interest after the due date', () => {
    const lateDisbursedAt = new Date('2026-08-01T06:00:00.000Z');
    const lateTenureDays = computeTenureDays(lateDisbursedAt, new Date('2026-08-31T00:00:00.000Z'));
    const due = computeAmountDueNowInr(principal, dailyRate, lateDisbursedAt, {
      asOf: new Date('2026-09-05T10:00:00.000Z'),
      coolingPeriodDays: 7,
      tenureDays: lateTenureDays,
      overdueDays: 5,
    });
    const tenureInterest = computeInterestAmountInr(principal, dailyRate, lateTenureDays);
    const overdueInterest = computeInterestAmountInr(principal, dailyRate, 5);
    expect(due.usedFullTenureInterest).toBe(true);
    expect(due.interestAmount).toBe(tenureInterest);
    expect(due.overdueDays).toBe(5);
    expect(due.overdueInterestAmount).toBe(overdueInterest);
    expect(due.totalInterestAmount).toBe(tenureInterest + overdueInterest);
    expect(due.amountDue).toBe(principal + tenureInterest + overdueInterest);
  });

  it('does not add overdue interest when overdueDays is 0', () => {
    const due = computeAmountDueNowInr(principal, dailyRate, disbursedAt, {
      asOf: new Date('2026-07-31T10:00:00.000Z'),
      coolingPeriodDays: 7,
      tenureDays,
      overdueDays: 0,
    });
    expect(due.overdueInterestAmount).toBe(0);
    expect(due.totalInterestAmount).toBe(due.interestAmount);
    expect(due.amountDue).toBe(principal + due.interestAmount);
  });
});

describe('resolveContractedTenureDays', () => {
  const disbursedAt = new Date('2026-07-13T06:00:00.000Z');
  const maturity = new Date('2026-07-31T00:00:00.000Z');

  it('uses disbursement → maturity after funding, ignoring a stale stored day count', () => {
    expect(
      resolveContractedTenureDays({
        disbursedAt,
        maturityDate: maturity,
        expectedRepaymentDate: maturity,
        storedDays: 8,
      }),
    ).toBe(19);
  });

  it('uses live as-of → repay date before disbursement', () => {
    expect(
      resolveContractedTenureDays({
        expectedRepaymentDate: maturity,
        storedDays: 8,
        asOf: new Date('2026-07-24T06:00:00.000Z'),
      }),
    ).toBe(8);
  });

  it('falls back to stored days only when no repay date exists', () => {
    expect(
      resolveContractedTenureDays({
        storedDays: 8,
        asOf: new Date('2026-07-24T06:00:00.000Z'),
      }),
    ).toBe(8);
  });
});

describe('completedAgeYearsIst', () => {
  it('counts a completed birthday on the IST calendar day', () => {
    const dob = new Date('1968-07-10T00:00:00.000Z');
    expect(completedAgeYearsIst(dob, new Date('2026-08-23T08:00:00.000Z'))).toBe(58);
    expect(completedAgeYearsIst(dob, new Date('2026-07-10T00:00:00.000Z'))).toBe(58);
    expect(completedAgeYearsIst(dob, new Date('2026-07-09T18:29:00.000Z'))).toBe(57);
  });
});
