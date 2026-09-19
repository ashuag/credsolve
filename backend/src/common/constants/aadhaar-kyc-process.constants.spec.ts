import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AADHAAR_KYC_TYPE,
  aadhaarKycTypeLabel,
  parseAadhaarKycType,
} from './aadhaar-kyc-process.constants';

describe('aadhaar KYC type', () => {
  it('maps 1 DigiLocker and 2 OTP based', () => {
    assert.equal(AADHAAR_KYC_TYPE.DIGILOCKER, 1);
    assert.equal(AADHAAR_KYC_TYPE.OTP, 2);
    assert.equal(aadhaarKycTypeLabel(AADHAAR_KYC_TYPE.DIGILOCKER), 'DigiLocker');
    assert.equal(aadhaarKycTypeLabel(AADHAAR_KYC_TYPE.OTP), 'OTP based');
    assert.equal(aadhaarKycTypeLabel(null), 'DigiLocker');
  });

  it('parses numeric and legacy string stamps', () => {
    assert.equal(parseAadhaarKycType(1), AADHAAR_KYC_TYPE.DIGILOCKER);
    assert.equal(parseAadhaarKycType('2'), AADHAAR_KYC_TYPE.OTP);
    assert.equal(parseAadhaarKycType('DIGILOCKER'), AADHAAR_KYC_TYPE.DIGILOCKER);
    assert.equal(parseAadhaarKycType('OTP'), AADHAAR_KYC_TYPE.OTP);
    assert.equal(parseAadhaarKycType('unknown'), null);
  });
});
