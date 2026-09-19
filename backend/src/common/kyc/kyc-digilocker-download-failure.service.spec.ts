import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KycDigilockerDownloadFailureService } from './kyc-digilocker-download-failure.service';

describe('KycDigilockerDownloadFailureService', () => {
  it('uses settings default 2 when the OTP max row is missing', async () => {
    const service = new KycDigilockerDownloadFailureService(
      {
        client: {
          setting: { findFirst: async () => null },
        },
      } as never,
      { sendRejectionSms: async () => undefined } as never,
    );

    assert.equal(await service.readAadhaarXmlOtpMaxAttempts(), 2);
  });

  it('unlocks DigiLocker at the OTP max without rejecting the lead', async () => {
    let upsertArgs: unknown = null;
    const service = new KycDigilockerDownloadFailureService(
      {
        client: {
          setting: { findFirst: async () => null },
          applicationKyc: {
            findUnique: async () => ({ aadhaarXmlOtpAttempts: 1 }),
            upsert: async (args: unknown) => {
              upsertArgs = args;
              return {};
            },
          },
        },
      } as never,
      { sendRejectionSms: async () => undefined } as never,
    );

    const out = await service.recordXmlOtpFailureAndEscalate({
      leadId: 1n,
      applicationId: 9n,
    });

    assert.equal(out.digilockerFallback, true);
    assert.equal(out.leadRejected, false);
    assert.equal(out.terminalFailure, false);
    assert.equal(out.canRetry, false);
    assert.equal(out.attemptsUsed, 2);
    assert.equal(
      (upsertArgs as { update: { digilockerFallbackEligible?: boolean } }).update
        .digilockerFallbackEligible,
      true,
    );
  });

  it('rejects the lead after the 3rd DigiLocker download failure', async () => {
    let rejected = false;
    const service = new KycDigilockerDownloadFailureService(
      {
        client: {
          applicationKyc: {
            findUnique: async () => ({ digilockerAadhaarDownloadAttempts: 2 }),
            upsert: async () => ({}),
          },
          leadStatus: { findFirst: async () => ({ id: 2n }) },
          applicationStatus: { findFirst: async () => ({ id: 3n }) },
          rejectionReason: { findFirst: async () => ({ id: 4n }) },
          $transaction: async (fn: (tx: unknown) => Promise<void>) => {
            rejected = true;
            await fn({
              lead: { update: async () => ({}) },
              applicationKyc: { upsert: async () => ({}) },
              application: { update: async () => ({}) },
            });
          },
        },
      } as never,
      { sendRejectionSms: async () => undefined } as never,
    );

    const out = await service.recordFailureAndEscalate({
      leadId: 1n,
      applicationId: 9n,
    });

    assert.equal(out.attemptsUsed, 3);
    assert.equal(out.terminalFailure, true);
    assert.equal(out.leadRejected, true);
    assert.equal(out.canRetry, false);
    assert.equal(rejected, true);
  });
});
