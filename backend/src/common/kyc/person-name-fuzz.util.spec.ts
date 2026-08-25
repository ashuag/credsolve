import { computePersonNameFuzzScore, stripPersonNameHonorifics } from './person-name-fuzz.util';

describe('person-name-fuzz.util', () => {
  it('scores token-order and case-insensitive exact names at 100', () => {
    expect(computePersonNameFuzzScore('Saurabh Agarwal', 'AGARWAL SAURABH')).toBe(100);
    expect(computePersonNameFuzzScore('Mr. Saurabh Agarwal', 'SAURABH AGARWAL')).toBe(100);
  });

  it('scores a missing middle name as a high partial', () => {
    const score = computePersonNameFuzzScore('Saurabh Agarwal', 'Saurabh Kumar Agarwal');
    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThan(100);
  });

  it('scores a typo above a complete mismatch', () => {
    const typo = computePersonNameFuzzScore('Saurabh Agarwal', 'Saurab Agarwal');
    const other = computePersonNameFuzzScore('Saurabh Agarwal', 'Priya Sharma');
    expect(typo).toBeGreaterThan(other);
    expect(typo).toBeGreaterThanOrEqual(80);
  });

  it('returns 0 when either name is empty', () => {
    expect(computePersonNameFuzzScore('', 'Saurabh')).toBe(0);
    expect(computePersonNameFuzzScore('Saurabh', null)).toBe(0);
  });

  it('strips stacked honorifics', () => {
    expect(stripPersonNameHonorifics('Mr. Ms Saurabh')).toBe('Saurabh');
  });
});
