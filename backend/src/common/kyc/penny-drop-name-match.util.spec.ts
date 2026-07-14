import {
  compareJourneyNameToPennyDrop,
  extractPennyDropBankName,
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

  it('matches journey name ignoring token order and case', () => {
    const result = compareJourneyNameToPennyDrop({
      journeyFullName: 'Saurabh Agarwal',
      vendor: { status: 'success', data: { nameAtBank: 'AGARWAL SAURABH' } },
    });
    expect(result.matched).toBe(true);
  });

  it('rejects name mismatch', () => {
    const result = compareJourneyNameToPennyDrop({
      journeyFullName: 'Saurabh Agarwal',
      vendor: { status: 'success', data: { name_at_bank: 'Someone Else' } },
    });
    expect(result).toMatchObject({ matched: false, reason: 'name_mismatch' });
  });

  it('honors vendor nameMatch=false', () => {
    const result = compareJourneyNameToPennyDrop({
      journeyFullName: 'Saurabh Agarwal',
      vendor: { status: 'success', data: { nameMatch: false, name_at_bank: 'Saurabh Agarwal' } },
    });
    expect(result).toMatchObject({ matched: false, reason: 'vendor_name_mismatch' });
  });
});
