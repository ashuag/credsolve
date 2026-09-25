import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { AadhaarXmlOtpVendorService } from './aadhaar-xml-otp-vendor.service';

describe('AadhaarXmlOtpVendorService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TENACIO_CLIENT_ID = 'money_20593';
    process.env.TENACIO_API_KEY = 'test-key';
    process.env.VENDOR_HOST = 'https://api.tenacio.io/api/v1/services';
    process.env.TENACIO_AADHAAR_XML_OTP_SERVICE = 'xml-generate-otp';
    process.env.TENACIO_AADHAAR_XML_OTP_WORKFLOW_ID = 'otp-workflow';
    process.env.TENACIO_AADHAAR_XML_DOWNLOAD_SERVICE = 'xml-download';
    process.env.TENACIO_AADHAAR_XML_DOWNLOAD_WORKFLOW_ID = 'download-workflow';
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('posts generate-otp with redacted Aadhaar and workflow header', async () => {
    let received: Record<string, unknown> | null = null;
    const request = async (args: Record<string, unknown>) => {
      received = args;
      return {
        ok: true,
        httpStatus: 200,
        body: { status: 'success', data: { referenceId: '71235863' } },
      };
    };
    const service = new AadhaarXmlOtpVendorService({ request } as never);

    const out = await service.postGenerateOtp(
      { input: { aadhaarNumber: '844123451847', consent: true } },
      11n,
    );

    assert.equal(out.ok, true);
    assert.ok(received);
    assert.equal(received.serviceName, 'xml-generate-otp');
    assert.deepEqual(received.headers, {
      'client-id': 'money_20593',
      'x-api-key': 'test-key',
      'workflow-id': 'otp-workflow',
    });
    assert.deepEqual(received.body, { input: { aadhaarNumber: '844123451847', consent: true } });
    const redact = received.redactRequest as (body: unknown) => unknown;
    assert.deepEqual(redact({ input: { aadhaarNumber: '844123451847', consent: true } }), {
      input: { aadhaarNumber: 'XXXXXXXX1847', consent: true },
    });
  });

  it('posts xml-download with referenceId and otp', async () => {
    let received: Record<string, unknown> | null = null;
    const request = async (args: Record<string, unknown>) => {
      received = args;
      return {
        ok: true,
        httpStatus: 200,
        body: { status: 'success', data: { status: 'VALID', name: 'Test' } },
      };
    };
    const service = new AadhaarXmlOtpVendorService({ request } as never);

    await service.postXmlDownload({ input: { referenceId: '71235761', otp: '475720' } }, 11n);

    assert.ok(received);
    assert.equal(received.serviceName, 'xml-download');
    assert.equal((received.headers as Record<string, string>)['workflow-id'], 'download-workflow');
    assert.deepEqual(received.body, { input: { referenceId: '71235761', otp: '475720' } });
  });
});
