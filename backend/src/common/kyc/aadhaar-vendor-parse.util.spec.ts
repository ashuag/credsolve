import {
  buildDigilockerIdentityMismatchJson,
  extractAadhaarPhotoString,
  extractDigilockerIdentityMismatch,
  isDigilockerAadhaarCaptureComplete,
  isDigilockerSessionNotReadyError,
  isTenacioVendorBusinessSuccess,
} from './aadhaar-vendor-parse.util';

describe('isDigilockerSessionNotReadyError', () => {
  it('detects Tenacio Invalid Input before the DigiLocker session is usable', () => {
    expect(
      isDigilockerSessionNotReadyError({
        type: 'point',
        status: 'error',
        serviceError: { details: {}, message: 'Invalid Input' },
        serviceStatusCode: 400,
      }),
    ).toBe(true);
  });

  it('does not treat a successful Aadhaar payload as not-ready', () => {
    expect(
      isDigilockerSessionNotReadyError({
        status: 'success',
        data: { name: 'Example Name' },
        serviceStatusCode: 200,
      }),
    ).toBe(false);
    expect(
      isTenacioVendorBusinessSuccess({
        status: 'success',
        data: { name: 'Example Name' },
      }),
    ).toBe(true);
  });
});

describe('DigiLocker identity mismatch persist', () => {
  it('does not treat an identity-mismatch row as a completed capture', () => {
    const stored = buildDigilockerIdentityMismatchJson({
      httpStatus: 200,
      vendor: { status: 'success', data: { name: 'SANTHI FRANCIS', dob: '08-05-1981' } },
      photoRelativePath: null,
      reason: 'name_mismatch',
      message: 'Name on Aadhaar does not match the name on your loan application.',
    });
    expect(isDigilockerAadhaarCaptureComplete(stored)).toBe(false);
    expect(extractDigilockerIdentityMismatch(stored)).toEqual({
      reason: 'name_mismatch',
      message: 'Name on Aadhaar does not match the name on your loan application.',
    });
  });

  it('reads Surepass photo objects with format/content', () => {
    const jpeg = Buffer.alloc(180, 0xff);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    const vendor = {
      data: {
        photo: {
          format: 'JPEG',
          content: jpeg.toString('base64'),
        },
      },
    };
    expect(extractAadhaarPhotoString(vendor)?.startsWith('/9j/')).toBe(true);
  });
});
