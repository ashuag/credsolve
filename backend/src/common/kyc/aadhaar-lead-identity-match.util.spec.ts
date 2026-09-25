import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareAadhaarKycMismatchFlags,
  compareAadhaarToLeadProfile,
  describeAadhaarIdentityFailure,
  extractAadhaarIdentityFromVendor,
  isAadhaarNameMismatchReview,
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
    assert.equal(id.fullName, 'SAURABH AGARWAL');
    assert.notEqual(id.dateOfBirth, null);
  });

  it('matches profile when name and dob align', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'Saurabh Agarwal',
      leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
      vendor: vendorSample,
    });
    assert.deepEqual(result, { matched: true });
  });

  it('puts name mismatch into review without treating it as a hard reject', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'Other Person',
      leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
      vendor: vendorSample,
    });
    assert.equal(result.matched, false);
    if (!result.matched) {
      assert.equal(result.reason, 'name_mismatch');
    }
    assert.equal(isAadhaarNameMismatchReview(result), true);
  });

  it('rejects on dob mismatch', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'SAURABH AGARWAL',
      leadDateOfBirth: new Date(Date.UTC(1990, 0, 1)),
      vendor: vendorSample,
    });
    assert.equal(result.matched, false);
    if (!result.matched) {
      assert.equal(result.reason, 'dob_mismatch');
    }
    assert.equal(isAadhaarNameMismatchReview(result), false);
  });

  it('rejects on gender mismatch', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'SAURABH AGARWAL',
      leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
      leadGender: 'MALE',
      vendor: {
        status: 'success',
        data: { name: 'SAURABH AGARWAL', dob: '01-08-1986', gender: 'F' },
      },
    });
    assert.equal(result.matched, false);
    if (!result.matched) {
      assert.equal(result.reason, 'gender_mismatch');
    }
    assert.equal(isAadhaarNameMismatchReview(result), false);
  });

  it('rejects on dob mismatch even when the name also differs', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'Other Person',
      leadDateOfBirth: new Date(Date.UTC(1990, 0, 1)),
      leadGender: 'MALE',
      vendor: {
        status: 'success',
        data: { name: 'SAURABH AGARWAL', dob: '01-08-1986', gender: 'M' },
      },
    });
    assert.equal(result.matched, false);
    if (!result.matched) {
      assert.equal(result.reason, 'dob_mismatch');
    }
  });

  it('rejects on gender mismatch even when the name also differs', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'Other Person',
      leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
      leadGender: 'Male',
      vendor: {
        status: 'success',
        data: { name: 'ANUSHA GUPTA', dob: '01-08-1986', gender: 'F' },
      },
    });
    assert.equal(result.matched, false);
    if (!result.matched) {
      assert.equal(result.reason, 'gender_mismatch');
    }
  });

  it('matches M/F Aadhaar gender against lead Male/Female', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'SAURABH AGARWAL',
      leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
      leadGender: 'Male',
      vendor: {
        status: 'success',
        data: { name: 'SAURABH AGARWAL', dob: '01-08-1986', gender: 'M' },
      },
    });
    assert.deepEqual(result, { matched: true });
  });

  it('normalizes token order in names', () => {
    assert.equal(personNamesMatch('Agarwal Saurabh', 'SAURABH AGARWAL'), true);
  });

  it('flags name, DOB, and gender mismatches independently without rejecting', () => {
    const flags = compareAadhaarKycMismatchFlags({
      leadFullName: 'Other Person',
      leadDateOfBirth: new Date(Date.UTC(1990, 0, 1)),
      leadGender: 'MALE',
      vendor: {
        status: 'success',
        data: { name: 'SAURABH AGARWAL', dob: '01-08-1986', gender: 'F' },
      },
    });
    assert.deepEqual(flags, {
      name: true,
      dob: true,
      gender: true,
      messages: [
        'Name on Aadhaar does not match the name on the loan application.',
        'Date of birth on Aadhaar does not match the loan application.',
        'Gender on Aadhaar does not match the loan application.',
      ],
    });
  });

  it('returns no mismatch flags when profile and Aadhaar align', () => {
    const flags = compareAadhaarKycMismatchFlags({
      leadFullName: 'Saurabh Agarwal',
      leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
      leadGender: 'Male',
      vendor: {
        status: 'success',
        data: { name: 'SAURABH AGARWAL', dob: '01-08-1986', gender: 'M' },
      },
    });
    assert.deepEqual(flags, { name: false, dob: false, gender: false, messages: [] });
  });

  it('returns null mismatch flags when Aadhaar identity is missing', () => {
    assert.equal(
      compareAadhaarKycMismatchFlags({
        leadFullName: 'Saurabh Agarwal',
        leadDateOfBirth: new Date(Date.UTC(1986, 7, 1)),
        vendor: { status: 'success', data: {} },
      }),
      null,
    );
  });

  it('matches DD-MM-YYYY Aadhaar DOB against a UTC lead calendar date', () => {
    const result = compareAadhaarToLeadProfile({
      leadFullName: 'SANTHI FRANCIS',
      leadDateOfBirth: new Date(Date.UTC(1981, 4, 8)),
      vendor: {
        status: 'success',
        data: { name: 'SANTHI FRANCIS', dob: '08-05-1981' },
      },
    });
    assert.deepEqual(result, { matched: true });
  });

  it('describes a name mismatch with both application and Aadhaar values', () => {
    const failure = describeAadhaarIdentityFailure({
      leadFullName: 'Santhi Devi',
      leadDateOfBirth: new Date(Date.UTC(1981, 4, 8)),
      vendor: { status: 'success', data: { name: 'SANTHI FRANCIS', dob: '08-05-1981' } },
    });
    assert.equal(failure?.reason, 'name_mismatch');
    assert.equal(failure?.applicationName, 'Santhi Devi');
    assert.equal(failure?.applicationDob, '1981-05-08');
    assert.equal(failure?.aadhaarName, 'SANTHI FRANCIS');
    assert.equal(failure?.aadhaarDob, '1981-05-08');
    assert.match(failure?.message ?? '', /Name on Aadhaar/);
  });
});
