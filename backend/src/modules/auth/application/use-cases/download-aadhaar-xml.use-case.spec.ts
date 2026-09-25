import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AADHAAR_KYC_TYPE } from '../../../../common/constants/aadhaar-kyc-process.constants';
import { DownloadAadhaarXmlUseCase } from './download-aadhaar-xml.use-case';

function makeUseCase(opts: {
  referenceId?: string | null;
  priorAttempts?: number;
  maxAttempts?: number;
  vendor?: {
    configured?: boolean;
    ok?: boolean;
    httpStatus?: number | null;
    vendorBody?: unknown;
  };
}) {
  const persistCalls: Array<Record<string, unknown>> = [];
  const cleared: string[] = [];
  const escalations: unknown[] = [];
  const markedFallback: bigint[] = [];
  const vendorBody = opts.vendor?.vendorBody ?? {
    status: 'success',
    data: {
      status: 'VALID',
      name: 'Kalavalapu Ravi',
      dob: '25-09-2003',
      gender: 'M',
    },
  };
  const useCase = new DownloadAadhaarXmlUseCase(
    { findByUuid: async () => ({ id: 1n, uuid: 'cust', mobileNumber: '9999999999' }) } as never,
    { findActiveByCustomerId: async () => ({ id: 2n }) } as never,
    { ensureDraftApplicationForLead: async () => ({ id: 9n, uuid: 'app-uuid' }) } as never,
    {
      postXmlDownload: async () => ({
        configured: opts.vendor?.configured ?? true,
        ok: opts.vendor?.ok ?? true,
        httpStatus: opts.vendor?.httpStatus ?? 200,
        vendorBody,
      }),
    } as never,
    {
      read: async () => opts.referenceId ?? '71235761',
      clear: async (uuid: string) => {
        cleared.push(uuid);
      },
    } as never,
    {
      readAadhaarXmlOtpMaxAttempts: async () => opts.maxAttempts ?? 2,
      markDigilockerFallbackEligible: async (applicationId: bigint) => {
        markedFallback.push(applicationId);
      },
      recordXmlOtpFailureAndEscalate: async (args: unknown) => {
        escalations.push(args);
        return {
          attemptsUsed: (opts.priorAttempts ?? 0) + 1,
          attemptsAllowed: opts.maxAttempts ?? 2,
          canRetry: (opts.priorAttempts ?? 0) + 1 < (opts.maxAttempts ?? 2),
          leadRejected: false,
          terminalFailure: false,
          digilockerFallback: (opts.priorAttempts ?? 0) + 1 >= (opts.maxAttempts ?? 2),
        };
      },
    } as never,
    {
      completeFromVendorPayload: async (params: Record<string, unknown>) => {
        persistCalls.push(params);
        return {
          configured: true,
          ok: true,
          httpStatus: 200,
          vendor: params.vendor,
          persisted: true,
        };
      },
    } as never,
    {
      client: {
        applicationKyc: {
          findUnique: async () => ({
            kycStatus: 0,
            aadhaarXmlOtpAttempts: opts.priorAttempts ?? 0,
          }),
        },
        application: { findFirst: async () => ({ id: 9n }) },
        $queryRaw: async () => [{ loanDocumentsReviewedAt: new Date() }],
      },
    } as never,
  );
  return { useCase, persistCalls, cleared, escalations, markedFallback };
}

const req = { customerSession: { sub: 'cust' } } as never;

describe('DownloadAadhaarXmlUseCase', () => {
  it('persists aadhaarKycType OTP (2) and clears the Redis reference', async () => {
    const { useCase, persistCalls, cleared, escalations } = makeUseCase({});
    const out = await useCase.execute(req, { otp: '475720' });
    assert.equal(out.ok, true);
    assert.equal(persistCalls.length, 1);
    assert.equal(persistCalls[0]?.aadhaarKycType, AADHAAR_KYC_TYPE.OTP);
    assert.equal(persistCalls[0]?.vendorKind, 'tenacio');
    assert.deepEqual(cleared, ['app-uuid']);
    assert.equal(escalations.length, 0);
  });

  it('unlocks DigiLocker without rejecting when OTP attempts are already exhausted', async () => {
    const { useCase, persistCalls, markedFallback } = makeUseCase({
      priorAttempts: 2,
      maxAttempts: 2,
    });
    const out = await useCase.execute(req, { otp: '475720' });
    assert.equal(out.ok, false);
    assert.equal(out.digilockerFallback, true);
    assert.equal(out.leadRejected, false);
    assert.equal(persistCalls.length, 0);
    assert.deepEqual(markedFallback, [9n]);
  });

  it('does not persist when xml-download is not VALID', async () => {
    const { useCase, persistCalls, cleared, escalations } = makeUseCase({
      vendor: {
        ok: true,
        vendorBody: { status: 'success', data: { status: 'INVALID' } },
      },
    });
    const out = await useCase.execute(req, { otp: '000000' });
    assert.equal(out.ok, false);
    assert.equal(persistCalls.length, 0);
    assert.equal(cleared.length, 0);
    assert.equal(escalations.length, 1);
  });
});
