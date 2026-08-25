import {
  compareJourneyNameToPennyDrop,
  extractPennyDropBankName,
  stripPersonNameHonorifics,
} from './penny-drop-name-match.util';

describe('penny-drop-name-match.util', () => {
  it('extracts name_at_bank from data', () => {
    expect(
      extractPennyDropBankName({
        status: 'success',
        data: { name_at_bank: 'Saurabh Agarwal', account_exists: true },
      }),
    ).toBe('Saurabh Agarwal');
  });

  it('strips honorifics with or without a period and extra spaces', () => {
    expect(stripPersonNameHonorifics('Mr. Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('Mr Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('Ms. Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('Ms Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('Miss Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('Miss. Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('Mrs. Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('Mrs Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('mrs.  Saurabh Agarwal')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('  Mr.  Saurabh   Agarwal  ')).toBe('Saurabh Agarwal');
    expect(stripPersonNameHonorifics('Mr.Saurabh Agarwal')).toBe('Saurabh Agarwal');
  });

  it('matches journey name ignoring token order and case', () => {
    const result = compareJourneyNameToPennyDrop({
      journeyFullName: 'Saurabh Agarwal',
      vendor: { status: 'success', data: { nameAtBank: 'AGARWAL SAURABH' } },
    });
    expect(result.matched).toBe(true);
    expect(result.score).toBe(100);
  });

  it('matches when the bank name includes an honorific title', () => {
    const result = compareJourneyNameToPennyDrop({
      journeyFullName: 'Saurabh Agarwal',
      vendor: { status: 'success', data: { name_at_bank: 'Mr. Saurabh Agarwal' } },
    });
    expect(result.matched).toBe(true);
    expect(result.bankName).toBe('Mr. Saurabh Agarwal');
  });

  it('rejects name mismatch but still returns a fuzzing score', () => {
    const result = compareJourneyNameToPennyDrop({
      journeyFullName: 'Saurabh Agarwal',
      vendor: { status: 'success', data: { name_at_bank: 'Someone Else' } },
    });
    expect(result).toMatchObject({ matched: false, reason: 'name_mismatch' });
    expect(result.score).toEqual(expect.any(Number));
  });

  it('honors vendor nameMatch=false', () => {
    const result = compareJourneyNameToPennyDrop({
      journeyFullName: 'Saurabh Agarwal',
      vendor: { status: 'success', data: { nameMatch: false, name_at_bank: 'Saurabh Agarwal' } },
    });
    expect(result).toMatchObject({ matched: false, reason: 'vendor_name_mismatch' });
  });
});
