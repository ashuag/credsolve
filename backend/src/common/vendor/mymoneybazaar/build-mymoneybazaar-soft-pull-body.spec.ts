import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMyMoneyBazaarSoftPullBody,
  defaultPlaceholderEmail,
  formatDobYmd,
  mapGenderKeyToProvider,
  resolveEmail,
  splitFullName,
} from './build-mymoneybazaar-soft-pull-body';

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

describe('resolveEmail', () => {
  it('keeps a real, well-formed email (lower-cased)', () => {
    assert.equal(resolveEmail('Saurabh.Agarwal@Example.com', 'ph@moneycash.in'), 'saurabh.agarwal@example.com');
  });
  it('falls back to the placeholder for a missing / malformed email', () => {
    assert.equal(resolveEmail(null, 'ph@moneycash.in'), 'ph@moneycash.in');
    assert.equal(resolveEmail('not-an-email', 'ph@moneycash.in'), 'ph@moneycash.in');
  });
});

describe('defaultPlaceholderEmail', () => {
  it('builds a valid-format synthetic email from the mobile', () => {
    assert.equal(defaultPlaceholderEmail('8882911939'), 'noreply+8882911939@moneycash.in');
  });
});

describe('buildMyMoneyBazaarSoftPullBody', () => {
  const base = {
    fullName: 'Saurabh Agarwal',
    dateOfBirth: new Date('1986-08-01T00:00:00.000Z'),
    genderKey: 'MALE',
    mobileNumber: '8882911939',
    panNumber: 'aqtap4652r',
    email: 'saurabh@example.com',
    pincode: '122018',
    addressParts: ['12 MG Road', null, 'Gurgaon'],
    placeholderEmail: 'noreply+8882911939@moneycash.in',
    placeholderPincode: '560001',
  };

  it('builds the flat snake_case body from real lead_detail values', () => {
    assert.deepEqual(buildMyMoneyBazaarSoftPullBody(base), {
      first_name: 'Saurabh',
      last_name: 'Agarwal',
      dob: '1986-08-01',
      gender: 'Male',
      email: 'saurabh@example.com',
      phone_number: '8882911939',
      pan_card_number: 'AQTAP4652R',
      address: '12 MG Road, Gurgaon',
      pin_code: '122018',
    });
  });

  it('falls back to placeholders when email / pincode / address are missing', () => {
    assert.deepEqual(
      buildMyMoneyBazaarSoftPullBody({
        ...base,
        email: null,
        pincode: null,
        addressParts: [null, undefined, ''],
      }),
      {
        first_name: 'Saurabh',
        last_name: 'Agarwal',
        dob: '1986-08-01',
        gender: 'Male',
        email: 'noreply+8882911939@moneycash.in',
        phone_number: '8882911939',
        pan_card_number: 'AQTAP4652R',
        address: 'Address not on file',
        pin_code: '560001',
      },
    );
  });
});
