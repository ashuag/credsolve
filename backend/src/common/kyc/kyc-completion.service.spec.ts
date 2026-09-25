import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
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

describe('KycCompletionService.completeFromDigilockerAadhaar', () => {
  it('keeps COMPLETED when face/liveness already passed', async () => {
    const applicationKycWrites: unknown[] = [];
    const customerUpdates: unknown[] = [];
    const customerKycUpdates: unknown[] = [];
    const completedAt = new Date('2026-09-23T06:00:00.000Z');

    const tx = {
      applicationKyc: {
        findUnique: async () => ({
          kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
          kycCompletedAt: null,
          livenessPassed: true,
          livenessSelfiePath: 'selfie.jpg',
          livenessDoneAt: completedAt,
          livenessCheckedAt: completedAt,
        }),
        upsert: async (args: unknown) => {
          applicationKycWrites.push(args);
          return args;
        },
      },
      customer: {
        update: async (args: unknown) => {
          customerUpdates.push(args);
          return args;
        },
      },
      customerKyc: {
        findFirst: async () => ({
          id: 5n,
          customerId: 1n,
          aadhaarVerifiedAt: completedAt,
          aadhaarData: priorAadhaar,
          panCardNumber: null,
        }),
        create: async () => ({ id: 6n, customerId: 1n, panCardNumber: null }),
        update: async (args: unknown) => {
          customerKycUpdates.push(args);
          return args;
        },
      },
      application: {
        findUnique: async () => ({
          createdAt: new Date('2026-09-17T00:00:00.000Z'),
          kyc: { kycStatus: 0 },
        }),
      },
    };

    const service = new KycCompletionService({
      client: {
        $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      },
    } as never);

    await service.completeFromDigilockerAadhaar({
      applicationId: 9n,
      customerId: 1n,
      digilockerAadhaarFormJson: priorAadhaar,
      aadhaarPhotoRelativePath: 'aadhaar.jpg',
      verifiedAt: new Date('2026-09-23T07:00:00.000Z'),
    });

    const write = applicationKycWrites[0] as {
      update: { kycStatus: number; kycCompletedAt: Date };
    };
    assert.equal(write.update.kycStatus, APPLICATION_KYC_STATUS.COMPLETED);
    assert.equal(write.update.kycCompletedAt.toISOString(), completedAt.toISOString());
    assert.equal(customerUpdates.length, 1);
    assert.equal(customerKycUpdates.length, 1);
  });

  it('resets to NOT_DONE when DigiLocker alone finishes before face step', async () => {
    const applicationKycWrites: unknown[] = [];
    const tx = {
      applicationKyc: {
        findUnique: async () => ({
          kycStatus: APPLICATION_KYC_STATUS.COMPLETED,
          kycCompletedAt: new Date('2026-09-23T05:00:00.000Z'),
          livenessPassed: false,
          livenessSelfiePath: null,
          livenessDoneAt: null,
          livenessCheckedAt: null,
        }),
        upsert: async (args: unknown) => {
          applicationKycWrites.push(args);
          return args;
        },
      },
      customer: {
        update: async () => {
          throw new Error('must not update customer when face step incomplete');
        },
      },
      customerKyc: {
        findFirst: async () => ({
          id: 5n,
          customerId: 1n,
          aadhaarVerifiedAt: null,
          aadhaarData: null,
          panCardNumber: null,
        }),
        create: async () => ({ id: 6n, customerId: 1n, panCardNumber: null }),
        update: async (args: unknown) => args,
      },
      application: {
        findUnique: async () => ({
          createdAt: new Date('2026-09-17T00:00:00.000Z'),
          kyc: { kycStatus: 1 },
        }),
      },
    };

    const service = new KycCompletionService({
      client: {
        $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      },
    } as never);

    await service.completeFromDigilockerAadhaar({
      applicationId: 9n,
      customerId: 1n,
      digilockerAadhaarFormJson: priorAadhaar,
      aadhaarPhotoRelativePath: 'aadhaar.jpg',
      verifiedAt: new Date('2026-09-23T07:00:00.000Z'),
    });

    const write = applicationKycWrites[0] as {
      update: { kycStatus: number; kycCompletedAt: Date | null };
    };
    assert.equal(write.update.kycStatus, APPLICATION_KYC_STATUS.NOT_DONE);
    assert.equal(write.update.kycCompletedAt, null);
  });
});

describe('KycCompletionService.ensureCompletedWhenFaceStepDone', () => {
  it('marks COMPLETED when DigiLocker + liveness already passed but status is NOT_DONE', async () => {
    const completedAt = new Date('2026-09-23T06:07:00.000Z');
    const aadhaarData = { name: 'SAKETH', dob: '23-05-1998', gender: 'M', uid: 'xxxxxxxxxxxx' };
    let completeAfterCalled = false;

    const service = new KycCompletionService({
      client: {
        application: {
          findUnique: async () => ({
            createdAt: new Date('2026-09-20T00:00:00.000Z'),
            kyc: {
              kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
              kycCompletedAt: null,
              livenessPassed: true,
              livenessSelfiePath: 'selfie.jpg',
              livenessDoneAt: completedAt,
              livenessCheckedAt: completedAt,
              livenessVendorJson: {
                activeLiveness: { passed: true, headMovementScore: 1 },
              },
            },
          }),
        },
        customerKyc: {
          findMany: async () => [
            {
              aadhaarData,
              aadhaarPhotoPath: 'aadhaar.jpg',
              aadhaarVerifiedAt: new Date('2026-09-23T06:04:00.000Z'),
            },
          ],
        },
      },
    } as never);

    service.completeAfterFaceLiveness = async () => {
      completeAfterCalled = true;
    };

    const out = await service.ensureCompletedWhenFaceStepDone({
      applicationId: 9n,
      customerId: 1n,
    });

    assert.equal(out.healed, true);
    assert.equal(out.kycStatus, APPLICATION_KYC_STATUS.COMPLETED);
    assert.equal(out.kycCompletedAt?.toISOString(), completedAt.toISOString());
    assert.equal(completeAfterCalled, true);
  });
});
