import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import {
  customerAadhaarAppliesToApplication,
  isReusableCustomerAadhaar,
  parseKycValidityDays,
  pickCustomerAadhaarForApplication,
  isAadhaarReusedFromPrior,
  markAadhaarReusedFromPrior,
  pickCustomerAadhaarForLos,
  sessionAadhaarAllowsSkip,
  shouldStartNewCustomerKycBundle,
} from './customer-aadhaar-for-application.util';

describe('customer-aadhaar-for-application', () => {
  const applicationCreatedAt = new Date('2026-09-17T00:00:00.000Z');
  const priorVerifiedAt = new Date('2026-08-01T00:00:00.000Z');
  const currentVerifiedAt = new Date('2026-09-17T12:00:00.000Z');

  it('does not reuse a prior application Aadhaar on a new application', () => {
    assert.equal(
      customerAadhaarAppliesToApplication(
        { aadhaarVerifiedAt: priorVerifiedAt, aadhaarData: { name: 'ANUSHA GUPTA' } },
        { applicationCreatedAt, applicationKycStatus: APPLICATION_KYC_STATUS.NOT_DONE },
      ),
      false,
    );
  });

  it('keeps Aadhaar captured during this application', () => {
    assert.equal(
      customerAadhaarAppliesToApplication(
        { aadhaarVerifiedAt: currentVerifiedAt, aadhaarData: { name: 'ANUSHA GUPTA' } },
        { applicationCreatedAt, applicationKycStatus: APPLICATION_KYC_STATUS.NOT_DONE },
      ),
      true,
    );
  });

  it('still shows Aadhaar on the KYC-failed application that stored it', () => {
    assert.equal(
      customerAadhaarAppliesToApplication(
        { aadhaarVerifiedAt: null, aadhaarData: { _identityMismatch: true } },
        { applicationCreatedAt, applicationKycStatus: APPLICATION_KYC_STATUS.FAILED },
      ),
      true,
    );
  });

  it('picks the current bundle over a prior one', () => {
    const picked = pickCustomerAadhaarForApplication(
      [
        { aadhaarVerifiedAt: currentVerifiedAt, aadhaarData: { name: 'NEW' } },
        { aadhaarVerifiedAt: priorVerifiedAt, aadhaarData: { name: 'OLD' } },
      ],
      { applicationCreatedAt, applicationKycStatus: APPLICATION_KYC_STATUS.NOT_DONE },
    );
    assert.equal((picked?.aadhaarData as { name: string }).name, 'NEW');
  });

  it('starts a new customer_kyc row instead of overwriting a prior capture', () => {
    assert.equal(
      shouldStartNewCustomerKycBundle(
        { aadhaarVerifiedAt: priorVerifiedAt, aadhaarData: { name: 'OLD' } },
        { applicationCreatedAt, applicationKycStatus: APPLICATION_KYC_STATUS.NOT_DONE },
      ),
      true,
    );
    assert.equal(
      shouldStartNewCustomerKycBundle(
        { aadhaarVerifiedAt: currentVerifiedAt, aadhaarData: { name: 'CURRENT' } },
        { applicationCreatedAt, applicationKycStatus: APPLICATION_KYC_STATUS.NOT_DONE },
      ),
      false,
    );
  });

  it('parses KYC_VALIDITY_DAYS and defaults to 180', () => {
    assert.equal(parseKycValidityDays('90'), 90);
    assert.equal(parseKycValidityDays(''), 180);
    assert.equal(parseKycValidityDays('nope'), 180);
  });

  it('reuses a prior successful Aadhaar inside the validity window', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    const aadhaar = {
      name: 'SAURABH AGARWAL',
      dob: '01-08-1986',
      gender: 'M',
    };
    assert.equal(
      isReusableCustomerAadhaar(
        { aadhaarVerifiedAt: new Date('2026-08-01T00:00:00.000Z'), aadhaarData: aadhaar },
        {
          now,
          validityDays: 180,
          leadFullName: 'SAURABH AGARWAL',
          leadDateOfBirth: new Date('1986-08-01T00:00:00.000Z'),
          leadGender: 'MALE',
        },
      ),
      true,
    );
  });

  it('does not reuse Aadhaar after KYC_VALIDITY_DAYS', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    assert.equal(
      isReusableCustomerAadhaar(
        {
          aadhaarVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
          aadhaarData: { name: 'SAURABH AGARWAL', dob: '01-08-1986', gender: 'M' },
        },
        { now, validityDays: 180 },
      ),
      false,
    );
  });

  it('does not skip when reused Aadhaar DOB or gender does not match this application', () => {
    const aadhaar = { name: 'SAURABH AGARWAL', dob: '01-08-1986', gender: 'M' };
    assert.equal(
      sessionAadhaarAllowsSkip({
        formJson: aadhaar,
        leadFullName: 'SAURABH AGARWAL',
        leadDateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        leadGender: 'MALE',
      }),
      false,
    );
    assert.equal(
      sessionAadhaarAllowsSkip({
        formJson: aadhaar,
        leadFullName: 'SAURABH AGARWAL',
        leadDateOfBirth: new Date('1986-08-01T00:00:00.000Z'),
        leadGender: 'FEMALE',
      }),
      false,
    );
  });

  it('LOS falls back to the previous successful Aadhaar for this number', () => {
    const picked = pickCustomerAadhaarForLos(
      [
        { aadhaarVerifiedAt: priorVerifiedAt, aadhaarData: { name: 'PRIOR', dob: '01-08-1986' } },
      ],
      { applicationCreatedAt, applicationKycStatus: APPLICATION_KYC_STATUS.NOT_DONE },
    );
    assert.equal((picked?.aadhaarData as { name: string }).name, 'PRIOR');
  });

  it('LOS skips an incomplete applying row and shows the prior successful Aadhaar', () => {
    const picked = pickCustomerAadhaarForLos(
      [
        { aadhaarVerifiedAt: currentVerifiedAt, aadhaarData: { _vendorAttempt: true } },
        { aadhaarVerifiedAt: priorVerifiedAt, aadhaarData: { name: 'PRIOR', dob: '01-08-1986' } },
      ],
      { applicationCreatedAt, applicationKycStatus: APPLICATION_KYC_STATUS.NOT_DONE },
    );
    assert.equal((picked?.aadhaarData as { name: string }).name, 'PRIOR');
  });

  it('stamps reused Aadhaar so LOS can show it as linked from a prior KYC', () => {
    const stamped = markAadhaarReusedFromPrior(
      { name: 'PRIOR', dob: '01-08-1986' },
      priorVerifiedAt,
    );
    assert.equal(isAadhaarReusedFromPrior(stamped), true);
    assert.equal(stamped._reusedFromVerifiedAt, priorVerifiedAt.toISOString());
  });
});
