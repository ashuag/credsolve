import { evaluateNameMatchFuzzScore } from './los-name-match-dev-tools.service';

describe('evaluateNameMatchFuzzScore', () => {
  it('auto-passes token-order and honorific-only differences', () => {
    const result = evaluateNameMatchFuzzScore({
      customerName: 'Saurabh Agarwal',
      bankAccountName: 'Mr AGARWAL SAURABH',
      minScore: 100,
    });
    expect(result.score).toBe(100);
    expect(result.tokenMatch).toBe(true);
    expect(result.autoPass).toBe(true);
    expect(result.outcome).toBe('auto_pass');
  });

  it('sends a missing-middle-name pair to under-review when min score is 100', () => {
    const result = evaluateNameMatchFuzzScore({
      customerName: 'Saurabh Agarwal',
      bankAccountName: 'Saurabh Kumar Agarwal',
      minScore: 100,
    });
    expect(result.tokenMatch).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThan(100);
    expect(result.autoPass).toBe(false);
    expect(result.outcome).toBe('under_review');
  });

  it('auto-passes a partial score when it meets the configured minimum', () => {
    const result = evaluateNameMatchFuzzScore({
      customerName: 'Saurabh Agarwal',
      bankAccountName: 'Saurabh Kumar Agarwal',
      minScore: 70,
    });
    expect(result.tokenMatch).toBe(false);
    expect(result.autoPass).toBe(true);
    expect(result.outcome).toBe('auto_pass');
  });

  it('returns missing_name when either side is blank after stripping', () => {
    const result = evaluateNameMatchFuzzScore({
      customerName: 'Mr.',
      bankAccountName: 'Saurabh Agarwal',
      minScore: 100,
    });
    expect(result.outcome).toBe('missing_name');
    expect(result.score).toBe(0);
    expect(result.autoPass).toBe(false);
  });
});
