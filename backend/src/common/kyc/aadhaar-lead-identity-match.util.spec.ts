import {
  compareAadhaarToLeadProfile,
  extractAadhaarIdentityFromVendor,
  personNamesMatch,
} from './aadhaar-lead-identity-match.util';

describe('aadhaar-lead-identity-match', () => {
  const vendorSample = {
    status: 'success',
    data: {
      name: 'SAURABH AGARWAL',
      dob: '01-08-1986',
    },
  };

  it('extracts name and dob from Tenacio aadhaar download envelope', () => {
    const id = extractAadhaarIdentityFromVendor(vendorSample);
    expect(id.fullName).toBe('SAURABH AGARWAL');
    expect(id.dateOfBirth).not.toBeNull();
  });

  it('matches profile when name and dob align', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'Saurabh Agarwal',
      leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
      vendor: vendorSample,
    });
    expect(result).toEqual({ matched: true });
  });

  it('rejects on name mismatch', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'Other Person',
      leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
      vendor: vendorSample,
    });
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.reason).toBe('name_mismatch');
    }
  });

  it('rejects on dob mismatch', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'SAURABH AGARWAL',
      leadDateOfBirth: new Date(Date.UTC(1990, 0, 1)),
      vendor: vendorSample,
    });
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.reason).toBe('dob_mismatch');
    }
  });

  it('normalizes token order in names', () => {
    expect(personNamesMatch('Agarwal Saurabh', 'SAURABH AGARWAL')).toBe(true);
  });
});
