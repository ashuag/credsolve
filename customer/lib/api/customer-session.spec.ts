import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getCustomerJourneyResumePath,
  resolveKycStagePath,
  shouldResumeKycSelfie,
  type CustomerSessionResponse,
} from './customer-session';

function session(overrides: {
  captured: boolean;
  selfieCaptured?: boolean;
  livenessPassed?: boolean;
  kycCompleted?: boolean;
  leadStatus?: string;
}): CustomerSessionResponse {
  return {
    authenticated: true,
    lead: {
      uuid: 'lead',
      status: overrides.leadStatus ?? 'IN_PROGRESS',
      email: 'a@b.com',
      emailVerified: true,
      rejectedUntil: null,
    },
    journey: {
      detailsCompleted: true,
      loanSelectionCompleted: true,
      loanDocumentsCompleted: true,
      loanDocumentsAccepted: false,
      kycCompleted: overrides.kycCompleted ?? false,
      referencesCompleted: false,
      bankDetailsCompleted: false,
      bankNameReviewPending: false,
      bankVerificationFailed: false,
      aadhaarNameReviewPending: false,
    },
    kycFaceProgress: {
      applicationKycStatus: overrides.kycCompleted ? 1 : 0,
      digilockerAadhaarCaptured: overrides.captured,
      selfieCaptured: overrides.selfieCaptured ?? false,
      livenessPassed: overrides.livenessPassed ?? false,
      livenessCheckCompleted: overrides.livenessPassed ?? false,
      livenessRequired: true,
      headMovementRequired: true,
      headMovementCaptured: overrides.livenessPassed ?? false,
      headMovementPassed: overrides.livenessPassed ?? false,
      digilockerAadhaarForm: overrides.captured ? { name: 'SAURABH' } : null,
      digilockerAadhaarPhotoUrl: null,
    },
  } as CustomerSessionResponse;
}

describe('shouldResumeKycSelfie', () => {
  it('sends the customer to selfie when prior Aadhaar is already captured', () => {
    const next = session({ captured: true });
    assert.equal(shouldResumeKycSelfie(next), true);
    assert.equal(resolveKycStagePath(next), '/kyc/selfie');
  });

  it('keeps the Aadhaar hub when nothing is captured yet', () => {
    const next = session({ captured: false });
    assert.equal(shouldResumeKycSelfie(next), false);
    assert.equal(resolveKycStagePath(next), '/kyc');
  });
});

describe('getCustomerJourneyResumePath', () => {
  it('continues to bank details after DigiLocker KYC even if the lead is INTERNAL_ERROR', () => {
    const next = session({
      captured: true,
      selfieCaptured: true,
      livenessPassed: true,
      kycCompleted: true,
      leadStatus: 'INTERNAL_ERROR',
    });
    assert.equal(getCustomerJourneyResumePath(next), '/bank-details');
  });

  it('resumes selfie after Aadhaar OTP fallback when DigiLocker passed and INTERNAL_ERROR remains', () => {
    const next = session({
      captured: true,
      selfieCaptured: false,
      leadStatus: 'INTERNAL_ERROR',
    });
    assert.equal(getCustomerJourneyResumePath(next), '/kyc/selfie');
  });
});
