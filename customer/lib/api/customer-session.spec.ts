import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveKycStagePath, shouldResumeKycSelfie, type CustomerSessionResponse } from './customer-session';

function session(overrides: {
  captured: boolean;
  selfieCaptured?: boolean;
  livenessPassed?: boolean;
}): CustomerSessionResponse {
  return {
    authenticated: true,
    lead: {
      uuid: 'lead',
      status: 'IN_PROGRESS',
      email: 'a@b.com',
      emailVerified: true,
      rejectedUntil: null,
    },
    journey: {
      detailsCompleted: true,
      loanSelectionCompleted: true,
      loanDocumentsCompleted: true,
      loanDocumentsAccepted: false,
      kycCompleted: false,
      referencesCompleted: false,
      bankDetailsCompleted: false,
      bankNameReviewPending: false,
      bankVerificationFailed: false,
      aadhaarNameReviewPending: false,
    },
    kycFaceProgress: {
      applicationKycStatus: 0,
      digilockerAadhaarCaptured: overrides.captured,
      selfieCaptured: overrides.selfieCaptured ?? false,
      livenessPassed: overrides.livenessPassed ?? false,
      livenessRequired: true,
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
