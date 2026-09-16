import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import {
  customerAadhaarAppliesToApplication,
  pickCustomerAadhaarForApplication,
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
});
