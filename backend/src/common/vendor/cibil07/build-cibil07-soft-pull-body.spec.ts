import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCibil07SoftPullBody,
  formatDobYmd,
  isProviderEmail,
  isProviderPincode,
  joinAddressParts,
  mapGenderKeyToProvider,
  splitFullName,
} from './build-cibil07-soft-pull-body';

describe('splitFullName', () => {
  it('splits multi-token names', () => {
    assert.deepEqual(splitFullName('Saurabh Kumar Agarwal'), {
      firstName: 'Saurabh',
      lastName: 'Kumar Agarwal',
    });
  });
  it('repeats a single token as the last name', () => {
    assert.deepEqual(splitFullName('Saurabh'), { firstName: 'Saurabh', lastName: 'Saurabh' });
  });
  it('falls back to NA for a blank name', () => {
    assert.deepEqual(splitFullName('   '), { firstName: 'NA', lastName: 'NA' });
  });
});

describe('mapGenderKeyToProvider', () => {
  for (const [key, expected] of [
    ['MALE', 'Male'],
    ['FEMALE', 'Female'],
    ['OTHERS', 'Other'],
    [null, 'Other'],
  ] as const) {
    it(`${String(key)} -> ${expected}`, () => {
      assert.equal(mapGenderKeyToProvider(key), expected);
    });
  }
});

describe('formatDobYmd', () => {
  it('formats a UTC-midnight date', () => {
    assert.equal(formatDobYmd(new Date('1986-08-01T00:00:00.000Z')), '1986-08-01');
  });
});

describe('isProviderEmail', () => {
  it('accepts a well-formed address', () => {
    assert.equal(isProviderEmail('saurabh.agarwal@example.com'), true);
  });
  it('rejects blanks and malformed values', () => {
    assert.equal(isProviderEmail(''), false);
    assert.equal(isProviderEmail('not-an-email'), false);
  });
});

describe('isProviderPincode', () => {
  it('accepts a 6-digit PIN not starting with 0', () => {
    assert.equal(isProviderPincode('122018'), true);
  });
  it('rejects other shapes', () => {
    assert.equal(isProviderPincode('012345'), false);
    assert.equal(isProviderPincode('12345'), false);
    assert.equal(isProviderPincode(''), false);
  });
});

describe('joinAddressParts', () => {
  it('joins the non-empty parts with ", "', () => {
    assert.equal(joinAddressParts(['12 MG Road', null, 'Gurgaon']), '12 MG Road, Gurgaon');
  });
  it('returns an empty string when nothing is present', () => {
    assert.equal(joinAddressParts([null, undefined, '  ']), '');
  });
});

describe('buildCibil07SoftPullBody', () => {
  it('builds the flat snake_case body from validated lead_detail values', () => {
    assert.deepEqual(
      buildCibil07SoftPullBody({
        fullName: 'Saurabh Agarwal',
        dateOfBirth: new Date('1986-08-01T00:00:00.000Z'),
        genderKey: 'MALE',
        mobileNumber: '8882911939',
        panNumber: 'aqtap4652r',
        email: 'Saurabh@Example.com',
        pincode: '122018',
        address: '12 MG Road, Gurgaon',
      }),
      {
        first_name: 'Saurabh',
        last_name: 'Agarwal',
        dob: '1986-08-01',
        gender: 'Male',
        email: 'saurabh@example.com',
        phone_number: '8882911939',
        pan_card_number: 'AQTAP4652R',
        address: '12 MG Road, Gurgaon',
        pin_code: '122018',
      },
    );
  });
});
