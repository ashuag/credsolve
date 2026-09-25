import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DownloadAadhaarDigilockerUseCase } from './download-aadhaar-digilocker.use-case';

function makeUseCase(opts: { eligible?: boolean; storedToken?: string | null }) {
  const downloadCalls: unknown[] = [];
  const useCase = new DownloadAadhaarDigilockerUseCase(
    { findByUuid: async () => ({ id: 1n, uuid: 'cust', mobileNumber: '9999999999' }) } as never,
    { findActiveByCustomerId: async () => ({ id: 2n }) } as never,
    {
      downloadAadhaar: async (...args: unknown[]) => {
        downloadCalls.push(args);
        return { configured: true, ok: true, httpStatus: 200, vendorBody: {} };
      },
    } as never,
    {
      readSession: async () => (opts.storedToken ? { token: opts.storedToken, vendor: 'tenacio' } : null),
    } as never,
    { ensureDraftApplicationForLead: async () => ({ id: 9n, uuid: 'app-uuid' }) } as never,
    {} as never,
    {} as never,
    {
      isDigilockerFallbackEligible: async () => opts.eligible ?? false,
      readAttemptsUsed: async () => 0,
    } as never,
    {} as never,
    { recoverLeadIfAadhaarCaptured: async () => false } as never,
    {
      client: {
        applicationKyc: {
          findUnique: async () => ({ kycStatus: 0 }),
        },
        application: { findFirst: async () => ({ id: 9n }) },
        $queryRaw: async () => [{ loanDocumentsReviewedAt: new Date() }],
      },
    } as never,
  );
  return { useCase, downloadCalls };
}

const req = { customerSession: { sub: 'cust' } } as never;

describe('DownloadAadhaarDigilockerUseCase', () => {
  it('rejects DigiLocker download until OTP fallback has unlocked it', async () => {
    const { useCase, downloadCalls } = makeUseCase({ eligible: false });
    await assert.rejects(
      () => useCase.execute(req, {}),
      /only after Aadhaar OTP download fails/,
    );
    assert.equal(downloadCalls.length, 0);
  });
});
