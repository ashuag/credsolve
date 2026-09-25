import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPLICATION_STATUS } from '../../common/constants/application.constants';
import { LEAD_STATUS } from '../../common/constants/lead.constants';
import { canEnableAadhaarReattempt } from './kyc-grant-retry.util';

describe('canEnableAadhaarReattempt', () => {
  it('allows reset after OTP or DigiLocker budget was used', async () => {
    assert.equal(
      canEnableAadhaarReattempt({
        aadhaarCaptured: false,
        otpAttempts: 2,
        digilockerAttempts: 0,
        digilockerFallbackEligible: true,
        applicationStatusCode: APPLICATION_STATUS.IN_REVIEW,
        leadStatusCode: LEAD_STATUS.IN_PROGRESS,
        kycFailed: false,
      }),
      true,
    );
  });

  it('allows KYC_FAILED + REJECTED so ops can recover the lead', async () => {
    assert.equal(
      canEnableAadhaarReattempt({
        aadhaarCaptured: false,
        otpAttempts: 0,
        digilockerAttempts: 3,
        digilockerFallbackEligible: true,
        applicationStatusCode: APPLICATION_STATUS.KYC_FAILED,
        leadStatusCode: LEAD_STATUS.REJECTED,
        kycFailed: true,
      }),
      true,
    );
  });

  it('hides the action when Aadhaar is already captured or the book is closed', async () => {
    assert.equal(
      canEnableAadhaarReattempt({
        aadhaarCaptured: true,
        otpAttempts: 2,
        digilockerAttempts: 0,
        digilockerFallbackEligible: true,
        applicationStatusCode: APPLICATION_STATUS.IN_REVIEW,
        leadStatusCode: LEAD_STATUS.IN_PROGRESS,
        kycFailed: false,
      }),
      false,
    );
    assert.equal(
      canEnableAadhaarReattempt({
        aadhaarCaptured: false,
        otpAttempts: 2,
        digilockerAttempts: 0,
        digilockerFallbackEligible: true,
        applicationStatusCode: APPLICATION_STATUS.DISBURSED,
        leadStatusCode: LEAD_STATUS.CONVERTED,
        kycFailed: false,
      }),
      false,
    );
  });

  it('allows a captured Aadhaar to be retried after KYC identity rejection', async () => {
    assert.equal(
      canEnableAadhaarReattempt({
        aadhaarCaptured: true,
        otpAttempts: 0,
        digilockerAttempts: 1,
        digilockerFallbackEligible: false,
        applicationStatusCode: APPLICATION_STATUS.REJECTED,
        leadStatusCode: LEAD_STATUS.REJECTED,
        kycFailed: true,
      }),
      true,
    );
    assert.equal(
      canEnableAadhaarReattempt({
        aadhaarCaptured: true,
        otpAttempts: 0,
        digilockerAttempts: 1,
        digilockerFallbackEligible: false,
        applicationStatusCode: APPLICATION_STATUS.KYC_FAILED,
        leadStatusCode: LEAD_STATUS.REJECTED,
        kycFailed: true,
      }),
      true,
    );
  });
});
