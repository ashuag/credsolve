import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GenerateAadhaarXmlOtpUseCase } from './generate-aadhaar-xml-otp.use-case';

function makeUseCase(opts: {
  existingRef?: string | null;
  priorAttempts?: number;
  maxAttempts?: number;
  applicationFormJson?: unknown;
  linkComplete?: boolean;
  vendor?: {
    configured?: boolean;
    ok?: boolean;
    httpStatus?: number | null;
    vendorBody?: unknown;
    skipReason?: string;
  };
  escalation?: {
    attemptsUsed: number;
    attemptsAllowed: number;
    canRetry: boolean;
    leadRejected: boolean;
    terminalFailure: boolean;
    digilockerFallback: boolean;
  };
}) {
  const saved: string[] = [];
  const escalations: unknown[] = [];
  const markedFallback: bigint[] = [];
  const storedAadhaar: string[] = [];
  let vendorCalls = 0;
  const useCase = new GenerateAadhaarXmlOtpUseCase(
    { findByUuid: async () => ({ id: 1n, uuid: 'cust', mobileNumber: '9999999999' }) } as never,
    { findActiveByCustomerId: async () => ({ id: 2n }) } as never,
    {
      ensureDraftApplicationForLead: async () => ({
        id: 9n,
        uuid: 'app-uuid',
        digilockerAadhaarFormJson: opts.applicationFormJson ?? null,
      }),
    } as never,
    {
      postGenerateOtp: async () => {
        vendorCalls += 1;
        return {
          configured: opts.vendor?.configured ?? true,
          ok: opts.vendor?.ok ?? true,
          httpStatus: opts.vendor?.httpStatus ?? 200,
          vendorBody: opts.vendor?.vendorBody ?? {
            status: 'success',
            data: { referenceId: '71235863' },
          },
          skipReason: opts.vendor?.skipReason,
        };
      },
    } as never,
    {
      read: async () => opts.existingRef ?? null,
      save: async (_uuid: string, ref: string) => {
        saved.push(ref);
      },
    } as never,
    {
      readAadhaarXmlOtpMaxAttempts: async () => opts.maxAttempts ?? 2,
      markDigilockerFallbackEligible: async (applicationId: bigint) => {
        markedFallback.push(applicationId);
      },
      recordXmlOtpFailureAndEscalate: async (args: unknown) => {
        escalations.push(args);
        return (
          opts.escalation ?? {
            attemptsUsed: (opts.priorAttempts ?? 0) + 1,
            attemptsAllowed: opts.maxAttempts ?? 2,
            canRetry: (opts.priorAttempts ?? 0) + 1 < (opts.maxAttempts ?? 2),
            leadRejected: false,
            terminalFailure: false,
            digilockerFallback: (opts.priorAttempts ?? 0) + 1 >= (opts.maxAttempts ?? 2),
          }
        );
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
        applicationDetail: {
          upsert: async (args: { create?: { aadhaarNumber?: string }; update?: { aadhaarNumber?: string } }) => {
            const number = args.update?.aadhaarNumber ?? args.create?.aadhaarNumber;
            if (number) storedAadhaar.push(number);
            return {};
          },
        },
        application: {
          findFirst: async () => ({ id: 9n }),
        },
        $queryRaw: async () => [{ loanDocumentsReviewedAt: new Date() }],
      },
    } as never,
    {
      linkReusableAadhaarToApplication: async () => ({
        linked: false,
        complete: opts.linkComplete ?? false,
        reusedFromPrior: opts.linkComplete ?? false,
      }),
    } as never,
  );
  return { useCase, saved, escalations, markedFallback, storedAadhaar, getVendorCalls: () => vendorCalls };
}

const req = { customerSession: { sub: 'cust' } } as never;
const dto = { aadhaarNumber: '844123451847', consent: true as const };

describe('GenerateAadhaarXmlOtpUseCase', () => {
  it('allows OTP without a prior DigiLocker failure and stores referenceId', async () => {
    const { useCase, saved, escalations, storedAadhaar, getVendorCalls } = makeUseCase({});
    const out = await useCase.execute(req, dto);
    assert.equal(out.ok, true);
    assert.equal(out.referenceIdIssued, true);
    assert.equal(out.vendor, null);
    assert.deepEqual(saved, ['71235863']);
    assert.deepEqual(storedAadhaar, ['844123451847']);
    assert.equal(escalations.length, 0);
    assert.equal(getVendorCalls(), 1);
  });

  it('returns alreadyCaptured when reusable prior Aadhaar is linked to this application', async () => {
    const { useCase, getVendorCalls } = makeUseCase({ linkComplete: true });
    const out = await useCase.execute(req, dto);
    assert.equal(out.ok, true);
    assert.equal(out.alreadyCaptured, true);
    assert.equal(getVendorCalls(), 0);
  });

  it('returns alreadyCaptured without an error when this application already has Aadhaar', async () => {
    const { useCase, getVendorCalls } = makeUseCase({
      applicationFormJson: { name: 'Ravi', _aadhaarKycType: 2 },
    });
    const out = await useCase.execute(req, dto);
    assert.equal(out.ok, true);
    assert.equal(out.alreadyCaptured, true);
    assert.equal(getVendorCalls(), 0);
  });

  it('unlocks DigiLocker without rejecting when OTP attempts already hit the settings max', async () => {
    const { useCase, markedFallback, getVendorCalls } = makeUseCase({
      priorAttempts: 2,
      maxAttempts: 2,
    });
    const out = await useCase.execute(req, dto);
    assert.equal(out.ok, false);
    assert.equal(out.digilockerFallback, true);
    assert.equal(out.leadRejected, false);
    assert.equal(out.canRetry, false);
    assert.deepEqual(markedFallback, [9n]);
    assert.equal(getVendorCalls(), 0);
  });

  it('records an OTP failure and unlocks DigiLocker on the last allowed attempt', async () => {
    const { useCase, saved, escalations } = makeUseCase({
      priorAttempts: 1,
      maxAttempts: 2,
      vendor: {
        ok: false,
        httpStatus: 400,
        vendorBody: { status: 'error' },
      },
    });
    const out = await useCase.execute(req, dto);
    assert.equal(out.ok, false);
    assert.equal(out.referenceIdIssued, false);
    assert.equal(out.digilockerFallback, true);
    assert.equal(out.leadRejected, false);
    assert.equal(saved.length, 0);
    assert.equal(escalations.length, 1);
  });
});
