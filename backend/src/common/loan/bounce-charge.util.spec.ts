import {
  computePenalChargeInr,
  daysToMaturityIst,
  DEFAULT_PENAL_CHARGE_CONFIG,
  formatBounceAmountBand,
  formatPenalChargeDisplay,
  isRepaymentPastDue,
  overdueDaysFromMaturity,
  resolveBounceRatePerDayInr,
  renderBounceChargeTierHtmlRows,
} from './bounce-charge.util';

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

  it('applies penal rate percent of principal when overdue', () => {
    // ₹5,000 × 10% = ₹500, inside the ₹100–₹3,000 band.
    expect(computePenalChargeInr(5_000, 1)).toBe(500);
    expect(computePenalChargeInr(5_000, 10)).toBe(500);
  });

  it('raises a small percentage up to PENAL_MIN_INR', () => {
    // ₹500 × 10% = ₹50 → floor ₹100.
    expect(computePenalChargeInr(500, 1)).toBe(DEFAULT_PENAL_CHARGE_CONFIG.minInr);
  });

  it('caps a large percentage at PENAL_MAX_INR', () => {
    // ₹50,000 × 10% = ₹5,000 → ceiling ₹3,000.
    expect(computePenalChargeInr(50_000, 1)).toBe(DEFAULT_PENAL_CHARGE_CONFIG.maxInr);
    expect(computePenalChargeInr(50_000, 400)).toBe(DEFAULT_PENAL_CHARGE_CONFIG.maxInr);
  });

  it('charges nothing while the loan is within term', () => {
    expect(computePenalChargeInr(5_000, 0)).toBe(0);
    expect(computePenalChargeInr(5_000, -5)).toBe(0);
    expect(computePenalChargeInr(5_000, Number.NaN)).toBe(0);
  });

  it('honours operator penal settings including min and max', () => {
    const custom = { ratePercent: 12.5, minInr: 200, maxInr: 1_000 };
    expect(computePenalChargeInr(5_000, 1, custom)).toBe(625);
    expect(computePenalChargeInr(500, 1, custom)).toBe(200);
    expect(computePenalChargeInr(20_000, 1, custom)).toBe(1_000);
    // A missing or nonsensical setting must fall back, never uncap or zero the charge.
    expect(computePenalChargeInr(50_000, 1, { ratePercent: Number.NaN, minInr: -1, maxInr: 0 })).toBe(
      DEFAULT_PENAL_CHARGE_CONFIG.maxInr,
    );
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
