import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAadhaarXmlOtpFallbackService } from './vendor-api-error.util';

describe('isAadhaarXmlOtpFallbackService', () => {
  it('matches Tenacio Aadhaar XML OTP generate and download slugs', () => {
    assert.equal(isAadhaarXmlOtpFallbackService('xml-generate-otp'), true);
    assert.equal(isAadhaarXmlOtpFallbackService('xml-download'), true);
    assert.equal(isAadhaarXmlOtpFallbackService('Tenacio/xml-generate-otp'), true);
  });

  it('does not match other vendor services', () => {
    assert.equal(isAadhaarXmlOtpFallbackService('liveness'), false);
    assert.equal(isAadhaarXmlOtpFallbackService('aadhaar-download'), false);
    assert.equal(isAadhaarXmlOtpFallbackService(''), false);
  });
});
