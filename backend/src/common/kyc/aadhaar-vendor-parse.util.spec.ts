import {
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
