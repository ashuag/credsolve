import {
  formatBounceAmountBand,
  isRepaymentPastDue,
  resolveBounceFeeInr,
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

  it('resolves fee by amount band', () => {
    expect(resolveBounceFeeInr(0, tiers)).toBe(100);
    expect(resolveBounceFeeInr(2_000, tiers)).toBe(100);
    expect(resolveBounceFeeInr(2_001, tiers)).toBe(200);
    expect(resolveBounceFeeInr(12_000, tiers)).toBe(500);
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

  it('renders HTML rows', () => {
    const html = renderBounceChargeTierHtmlRows(tiers);
    expect(html).toContain('₹100/-');
    expect(html).toContain('10,001 and above');
  });
});
