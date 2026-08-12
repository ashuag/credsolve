import {
  computeBounceChargeInr,
  daysToMaturityIst,
  DEFAULT_PENAL_CHARGE_CONFIG,
  formatBounceAmountBand,
  formatPenalChargeDisplay,
  isRepaymentPastDue,
  overdueDaysFromMaturity,
  resolveBounceRatePerDayInr,
  renderBounceChargeTierHtmlRows,
} from './bounce-charge.util';

const MAX_BOUNCE_CHARGE_INR = DEFAULT_PENAL_CHARGE_CONFIG.maxInr;

describe('bounce-charge.util', () => {
  const tiers = [
    { minAmountInr: 0, maxAmountInr: 2_000, bounceFeeInr: 100, sortOrder: 1 },
    { minAmountInr: 2_001, maxAmountInr: 5_000, bounceFeeInr: 200, sortOrder: 2 },
    { minAmountInr: 5_001, maxAmountInr: 8_000, bounceFeeInr: 300, sortOrder: 3 },
    { minAmountInr: 8_001, maxAmountInr: 10_000, bounceFeeInr: 400, sortOrder: 4 },
    { minAmountInr: 10_001, maxAmountInr: null, bounceFeeInr: 500, sortOrder: 5 },
  ];

  it('resolves per-day rate by amount band', () => {
    expect(resolveBounceRatePerDayInr(0, tiers)).toBe(100);
    expect(resolveBounceRatePerDayInr(2_000, tiers)).toBe(100);
    expect(resolveBounceRatePerDayInr(2_001, tiers)).toBe(200);
    expect(resolveBounceRatePerDayInr(12_000, tiers)).toBe(500);
  });

  it('accrues bounce charge per overdue day', () => {
    // ₹2,001–5,000 band bills ₹200/day, so two days overdue is ₹400.
    expect(computeBounceChargeInr(3_000, 2, tiers)).toBe(400);
    expect(computeBounceChargeInr(3_000, 1, tiers)).toBe(200);
    expect(computeBounceChargeInr(12_000, 4, tiers)).toBe(2_000);
  });

  it('charges nothing while the loan is within term', () => {
    expect(computeBounceChargeInr(3_000, 0, tiers)).toBe(0);
    expect(computeBounceChargeInr(3_000, -5, tiers)).toBe(0);
    expect(computeBounceChargeInr(3_000, Number.NaN, tiers)).toBe(0);
  });

  it('caps accrual at the maximum penal charge', () => {
    // ₹500/day hits the ₹3,000 ceiling on day 6 and stays there.
    expect(computeBounceChargeInr(12_000, 5, tiers)).toBe(2_500);
    expect(computeBounceChargeInr(12_000, 6, tiers)).toBe(MAX_BOUNCE_CHARGE_INR);
    expect(computeBounceChargeInr(12_000, 400, tiers)).toBe(MAX_BOUNCE_CHARGE_INR);
    // A tiny loan can still never accrue more than the ceiling.
    expect(computeBounceChargeInr(10, 9_999, tiers)).toBe(MAX_BOUNCE_CHARGE_INR);
  });

  it('honours a cap supplied from the PENAL_MAX_INR setting', () => {
    expect(computeBounceChargeInr(12_000, 9, tiers, 1_000)).toBe(1_000);
    expect(computeBounceChargeInr(12_000, 9, tiers, 10_000)).toBe(4_500);
    // A missing or nonsensical setting must fall back, never uncap or zero the charge.
    for (const bad of [0, -1, Number.NaN, undefined]) {
      expect(computeBounceChargeInr(12_000, 400, tiers, bad as number)).toBe(MAX_BOUNCE_CHARGE_INR);
    }
  });

  it('formats penal parameters for the sanction letter', () => {
    expect(formatPenalChargeDisplay({ ratePercent: 10, minInr: 100, maxInr: 3_000 })).toEqual({
      ratePercent: '10%',
      minInr: '100',
      maxInr: '3,000',
    });
    expect(formatPenalChargeDisplay({ ratePercent: 12.5, minInr: 250, maxInr: 15_000 })).toEqual({
      ratePercent: '12.5%',
      minInr: '250',
      maxInr: '15,000',
    });
  });

  it('formats bands for documents', () => {
    expect(formatBounceAmountBand(0, 2_000)).toBe('0 – 2,000');
    expect(formatBounceAmountBand(10_001, null)).toBe('10,001 and above');
  });

  it('treats maturity day as on-time', () => {
    const maturity = new Date(Date.UTC(2026, 7, 31));
    expect(isRepaymentPastDue(maturity, new Date('2026-08-31T10:00:00+05:30'))).toBe(false);
    expect(isRepaymentPastDue(maturity, new Date('2026-09-01T00:30:00+05:30'))).toBe(true);
  });

  it('counts overdue days in IST, not the UTC server day', () => {
    const maturity = new Date(Date.UTC(2026, 6, 31));
    // 01:41 IST on 9 Aug is still 8 Aug in UTC; the IST answer is 9 days, not 8.
    const justAfterIstMidnight = new Date('2026-08-09T01:41:00+05:30');
    expect(overdueDaysFromMaturity(maturity, justAfterIstMidnight)).toBe(9);
    expect(daysToMaturityIst(maturity, justAfterIstMidnight)).toBe(-9);
  });

  it('keeps daysToMaturity the exact negation of overdueDays', () => {
    const maturity = new Date(Date.UTC(2026, 7, 31));
    for (const asOf of ['2026-08-20T12:00:00+05:30', '2026-08-31T23:59:00+05:30', '2026-09-05T00:10:00+05:30']) {
      const at = new Date(asOf);
      const overdue = overdueDaysFromMaturity(maturity, at);
      const remaining = daysToMaturityIst(maturity, at);
      expect(overdue).toBe(remaining < 0 ? -remaining : 0);
    }
  });

  it('renders HTML rows', () => {
    const html = renderBounceChargeTierHtmlRows(tiers);
    expect(html).toContain('₹100/-');
    expect(html).toContain('10,001 and above');
  });
});
