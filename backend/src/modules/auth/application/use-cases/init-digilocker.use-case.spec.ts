import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InitDigilockerUseCase } from './init-digilocker.use-case';

function makeUseCase(opts: { eligible?: boolean; storedToken?: string | null }) {
  const initializeCalls: unknown[] = [];
  const useCase = new InitDigilockerUseCase(
    { findByUuid: async () => ({ id: 1n, uuid: 'cust', mobileNumber: '9999999999' }) } as never,
    { findActiveByCustomerId: async () => ({ id: 2n }) } as never,
    { ensureDraftApplicationForLead: async () => ({ id: 9n, uuid: 'app-uuid' }) } as never,
    {
      initialize: async (...args: unknown[]) => {
        initializeCalls.push(args);
        return {
          configured: true,
          ok: true,
          httpStatus: 200,
          vendorBody: { redirectUrl: 'https://digilocker.example/login' },
          sessionToken: 'sess',
          digilockerLoginUrl: 'https://digilocker.example/login',
          vendorKind: 'tenacio',
        };
      },
    } as never,
    {
      readSession: async () => (opts.storedToken ? { token: opts.storedToken, vendor: 'tenacio' } : null),
      save: async () => undefined,
    } as never,
    {
      isDigilockerFallbackEligible: async () => opts.eligible ?? false,
    } as never,
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
  return { useCase, initializeCalls };
}

const req = { customerSession: { sub: 'cust' } } as never;

describe('InitDigilockerUseCase', () => {
  it('rejects DigiLocker init until OTP fallback has unlocked it', async () => {
    const { useCase, initializeCalls } = makeUseCase({ eligible: false });
    await assert.rejects(
      () => useCase.execute(req, {}),
      /only after Aadhaar OTP download fails/,
    );
    assert.equal(initializeCalls.length, 0);
  });

  it('starts DigiLocker after OTP attempts unlock the fallback', async () => {
    process.env.CUSTOMER_PORTAL_BASE_URL = 'https://customer.example';
    const { useCase, initializeCalls } = makeUseCase({ eligible: true });
    const out = await useCase.execute(req, { redirectUrl: 'https://customer.example/kyc/digilocker-callback' });
    assert.equal(out.ok, true);
    assert.equal(out.sessionToken, 'sess');
    assert.equal(initializeCalls.length, 1);
  });
});
