import {
  buildNocLetterNumber,
  formatNocDateLong,
  formatNocDateShort,
  formatNocLoanAmountInr,
  formatNocWaiver,
} from './noc-letter-html.util';

describe('noc-letter-html.util', () => {
  it('builds letter number as loanNumber + YYYYMMDDHHmmss', () => {
    const at = new Date('2026-07-14T10:05:09.000Z'); // 15:35:09 IST
    const letterNo = buildNocLetterNumber('APP2026K7M2Q', at);
    expect(letterNo).toMatch(/^APP2026K7M2Q\d{14}$/);
    expect(letterNo.startsWith('APP2026K7M2Q')).toBe(true);
  });

  it('formats short and long IST dates', () => {
    const at = new Date('2026-07-14T10:05:09.000Z');
    expect(formatNocDateShort(at)).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(formatNocDateLong(at)).toMatch(/July/);
  });

  it('formats amounts and waiver', () => {
    expect(formatNocLoanAmountInr(6000)).toContain('6,000');
    expect(formatNocWaiver(0)).toBe('0.0');
    expect(formatNocWaiver(12.5)).toContain('12.5');
  });
});
