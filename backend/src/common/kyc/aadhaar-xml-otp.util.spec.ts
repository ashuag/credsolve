import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractAadhaarXmlReferenceId,
  isAadhaarXmlDownloadValid,
  isValidAadhaarNumber,
  maskAadhaarNumber,
  redactAadhaarXmlOtpRequest,
} from './aadhaar-xml-otp.util';

describe('aadhaar-xml-otp.util', () => {
  it('validates and masks a 12-digit Aadhaar number', () => {
    assert.equal(isValidAadhaarNumber('844123451847'), true);
    assert.equal(isValidAadhaarNumber('84412345184'), false);
    assert.equal(maskAadhaarNumber('844123451847'), 'XXXXXXXX1847');
  });

  it('redacts aadhaarNumber before vendor audit logging', () => {
    assert.deepEqual(
      redactAadhaarXmlOtpRequest({
        input: { aadhaarNumber: '844123451847', consent: true },
      }),
      {
        input: { aadhaarNumber: 'XXXXXXXX1847', consent: true },
      },
    );
  });

  it('extracts referenceId from Tenacio generate-otp envelopes', () => {
    assert.equal(
      extractAadhaarXmlReferenceId({
        status: 'success',
        data: { referenceId: '71235863' },
      }),
      '71235863',
    );
  });

  it('treats xml-download VALID payloads as complete', () => {
    assert.equal(
      isAadhaarXmlDownloadValid({
        status: 'success',
        data: { status: 'VALID', name: 'Kalavalapu Ravi', dob: '25-09-2003' },
      }),
      true,
    );
    assert.equal(
      isAadhaarXmlDownloadValid({ status: 'success', data: { status: 'INVALID' } }),
      false,
    );
  });
});
