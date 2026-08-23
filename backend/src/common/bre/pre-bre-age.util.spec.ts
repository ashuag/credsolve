import { evaluatePreBreAge } from './pre-bre-age.util';

const dob10Jul1968 = new Date('1968-07-10T00:00:00.000Z');
const asOf23Aug2026 = new Date('2026-08-23T08:00:00.000Z');

describe('evaluatePreBreAge', () => {
  it('rejects DOB 10 Jul 1968 when MAX_AGE is 58 (already 58, tenure end still 58)', () => {
    const verdict = evaluatePreBreAge({
      dateOfBirth: dob10Jul1968,
      asOf: asOf23Aug2026,
      tenureEnd: new Date('2026-08-31T00:00:00.000Z'),
      minAge: 21,
      maxAge: 58,
    });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.code).toBe('MAX_AGE_BRE_FAILED');
      expect(verdict.currentAge).toBe(58);
      expect(verdict.ageAtTenureEnd).toBe(58);
    }
  });

  it('rejects a 57-year-old who turns 58 before tenure end', () => {
    const verdict = evaluatePreBreAge({
      dateOfBirth: new Date('1968-09-15T00:00:00.000Z'),
      asOf: asOf23Aug2026,
      tenureEnd: new Date('2026-09-30T00:00:00.000Z'),
      minAge: 21,
      maxAge: 58,
    });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.code).toBe('MAX_AGE_BRE_FAILED');
      expect(verdict.currentAge).toBe(57);
      expect(verdict.ageAtTenureEnd).toBe(58);
    }
  });

  it('rejects when already 58 even if the stored tenure date is in the past', () => {
    const verdict = evaluatePreBreAge({
      dateOfBirth: dob10Jul1968,
      asOf: asOf23Aug2026,
      tenureEnd: new Date('2026-06-30T00:00:00.000Z'),
      minAge: 21,
      maxAge: 58,
    });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.code).toBe('MAX_AGE_BRE_FAILED');
      expect(verdict.currentAge).toBe(58);
      expect(verdict.ageAtTenureEnd).toBe(57);
    }
  });

  it('allows a borrower who stays 57 through tenure end', () => {
    const verdict = evaluatePreBreAge({
      dateOfBirth: new Date('1968-10-20T00:00:00.000Z'),
      asOf: asOf23Aug2026,
      tenureEnd: new Date('2026-09-30T00:00:00.000Z'),
      minAge: 21,
      maxAge: 58,
    });
    expect(verdict.passed).toBe(true);
    if (verdict.passed) {
      expect(verdict.currentAge).toBe(57);
      expect(verdict.ageAtTenureEnd).toBe(57);
    }
  });

  it('rejects below min age', () => {
    const verdict = evaluatePreBreAge({
      dateOfBirth: new Date('2006-08-23T00:00:00.000Z'),
      asOf: asOf23Aug2026,
      tenureEnd: new Date('2026-09-30T00:00:00.000Z'),
      minAge: 21,
      maxAge: 58,
    });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.code).toBe('MIN_AGE_BRE_FAILED');
    }
  });
});
