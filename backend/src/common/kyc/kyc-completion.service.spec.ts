import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KycCompletionService } from './kyc-completion.service';

const priorVerifiedAt = new Date('2026-08-01T00:00:00.000Z');
const priorAadhaar = { name: 'SAURABH AGARWAL', dob: '01-08-1986', gender: 'M' };

function makeService(opts: {
  applying?: {
    id: bigint;
    aadhaarData: unknown;
    aadhaarVerifiedAt: Date | null;
  } | null;
  prior?: {
    id: bigint;
    aadhaarData: unknown;
    aadhaarVerifiedAt: Date | null;
  } | null;
}) {
  const created: unknown[] = [];
  const updated: unknown[] = [];
  const prior = opts.prior ?? {
    id: 11n,
    customerId: 1n,
    aadhaarData: priorAadhaar,
    aadhaarPhotoPath: 'aadhaar.jpg',
    aadhaarVerifiedAt: priorVerifiedAt,
    aadhaarKycType: 2,
    panCardNumber: null,
    panCardVerifiedAt: null,
  };
  const applying = opts.applying;
  const rows = [applying, prior].filter(Boolean);

  const tx = {
    application: {
      findUnique: async () => ({
        createdAt: new Date('2026-09-17T00:00:00.000Z'),
        kyc: { kycStatus: 0 },
      }),
    },
    customerKyc: {
      findFirst: async () => applying ?? prior,
      create: async ({ data }: { data: { customerId: bigint } }) => {
        const row = { id: 99n, ...data, panCardNumber: null };
        created.push(row);
        return row;
      },
      update: async (args: unknown) => {
        updated.push(args);
        return args;
      },
    },
    applicationDetail: {
      upsert: async (args: unknown) => args,
    },
  };

  const service = new KycCompletionService({
    client: {
      application: {
        findUnique: async () => ({
          createdAt: new Date('2026-09-17T00:00:00.000Z'),
          kyc: { kycStatus: 0 },
          details: { aadhaarNumber: null },
        }),
      },
      customerKyc: {
        findMany: async () => rows,
      },
      setting: {
        findFirst: async () => ({ value: '180' }),
      },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    },
  } as never);

  return { service, created, updated };
}

describe('KycCompletionService.linkReusableAadhaarToApplication', () => {
  it('copies a reusable prior Aadhaar onto this application', async () => {
    const { service, created, updated } = makeService({ applying: null });
    const out = await service.linkReusableAadhaarToApplication({
      applicationId: 9n,
      customerId: 1n,
      mobileNumber: '9999999999',
      leadFullName: 'SAURABH AGARWAL',
      leadDateOfBirth: new Date('1986-08-01T00:00:00.000Z'),
      leadGender: 'MALE',
    });
    assert.equal(out.linked, true);
    assert.equal(out.complete, true);
    assert.equal(out.reusedFromPrior, true);
    assert.equal(created.length, 1);
    const write = updated[0] as { data: { aadhaarData: { name: string; _reusedFromPriorKyc: boolean } } };
    assert.equal(write.data.aadhaarData.name, 'SAURABH AGARWAL');
    assert.equal(write.data.aadhaarData._reusedFromPriorKyc, true);
  });

  it('does not copy when this application already has Aadhaar', async () => {
    const { service, created } = makeService({
      applying: {
        id: 22n,
        aadhaarData: { name: 'CURRENT', dob: '01-08-1986' },
        aadhaarVerifiedAt: new Date('2026-09-18T00:00:00.000Z'),
      },
    });
    const out = await service.linkReusableAadhaarToApplication({
      applicationId: 9n,
      customerId: 1n,
    });
    assert.equal(out.linked, false);
    assert.equal(out.complete, true);
    assert.equal(created.length, 0);
  });
});
