import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PAN_VERIFIED } from '../constants/pan-verification.constants';
import { PanNsdlCacheService } from './pan-nsdl-cache.service';
import type { PanNsdlCacheRepository, PanNsdlCacheRow } from './pan-nsdl-cache.repository';
import type { PanVerificationService, PanVerificationResult } from './pan-verification.service';

const identity = {
  panNumber: 'ABCDE1234F',
  fullName: 'Ramesh Verma',
  dateOfBirth: new Date(Date.UTC(1990, 4, 12)),
};

const verifiedVendor: PanVerificationResult = {
  panVerifiedStatus: PAN_VERIFIED.VERIFIED,
  nameMatch: true,
  dobMatch: true,
  panStatus: 'valid',
  category: 'Individual',
  vendorRequestId: 'req-1',
  note: null,
};

function cacheRow(overrides: Partial<PanNsdlCacheRow> = {}): PanNsdlCacheRow {
  return {
    id: 9n,
    uuid: 'cache-uuid',
    panNumber: 'ABCDE1234F',
    fullName: 'RAMESH VERMA',
    dateOfBirth: new Date(Date.UTC(1990, 4, 12)),
    nsdlResponse: {
      status: 'success',
      success: true,
      data: { panStatus: 'valid', dobMatch: true, nameMatch: true, category: 'Individual' },
    },
    nameVerified: true,
    vendorRequestId: 'req-1',
    ...overrides,
  };
}

function makeService(opts: {
  byId?: PanNsdlCacheRow | null;
  byIdentity?: PanNsdlCacheRow | null;
  vendor?: PanVerificationResult & { vendorBody?: unknown };
  attached?: bigint[];
}) {
  const attached: bigint[] = opts.attached ?? [];
  const vendorCalls = { count: 0 };
  const repo = {
    findById: async () => opts.byId ?? null,
    findByIdentity: async () => opts.byIdentity ?? null,
    upsertVerifiedIdentity: async () => cacheRow(),
    attachToCustomer: async (_customerId: bigint, cacheId: bigint) => {
      attached.push(cacheId);
    },
  } as unknown as PanNsdlCacheRepository;

  const panVerification = {
    resultFromVendorBody: () => verifiedVendor,
    verifyWithVendor: async () => {
      vendorCalls.count += 1;
      return {
        ...verifiedVendor,
        vendorBody: opts.vendor?.vendorBody ?? { status: 'success', success: true, data: {} },
        configured: true,
        skipReason: null,
        httpStatus: 200,
        ...(opts.vendor ?? {}),
      };
    },
  } as unknown as PanVerificationService;

  return { service: new PanNsdlCacheService(repo, panVerification), attached, vendorCalls };
}

describe('PanNsdlCacheService.resolveForCustomer', () => {
  it('skips NSDL when recurring and customer cache id matches identity', async () => {
    const { service, attached, vendorCalls } = makeService({ byId: cacheRow() });
    const result = await service.resolveForCustomer({
      customerId: 1n,
      panNsdlCacheId: 9n,
      isRecurring: true,
      leadId: 3n,
      ...identity,
    });

    assert.equal(result.source, 'customer_cache');
    assert.equal(result.cacheUuid, 'cache-uuid');
    assert.deepEqual(attached, [9n]);
    assert.equal(vendorCalls.count, 0);
  });

  it('reuses pan+name+DOB cache for a new customer and attaches the FK', async () => {
    const { service, attached, vendorCalls } = makeService({ byIdentity: cacheRow() });
    const result = await service.resolveForCustomer({
      customerId: 1n,
      panNsdlCacheId: null,
      isRecurring: false,
      leadId: 3n,
      ...identity,
    });
    assert.equal(result.source, 'identity_cache');
    assert.deepEqual(attached, [9n]);
    assert.equal(vendorCalls.count, 0);
  });

  it('calls NSDL on miss and stores a row only when pan and DOB match', async () => {
    const { service, attached, vendorCalls } = makeService({
      vendor: {
        ...verifiedVendor,
        vendorBody: { status: 'success', success: true, data: { panStatus: 'valid', dobMatch: true } },
      },
    });
    const result = await service.resolveForCustomer({
      customerId: 1n,
      panNsdlCacheId: null,
      isRecurring: false,
      leadId: 3n,
      ...identity,
    });
    assert.equal(result.source, 'vendor');
    assert.equal(result.cacheUuid, 'cache-uuid');
    assert.deepEqual(attached, [9n]);
    assert.equal(vendorCalls.count, 1);
  });

  it('does not insert when DOB does not match', async () => {
    const { service, attached, vendorCalls } = makeService({
      vendor: {
        panVerifiedStatus: PAN_VERIFIED.NOT_VERIFIED,
        nameMatch: true,
        dobMatch: false,
        panStatus: 'valid',
        category: 'Individual',
        vendorRequestId: null,
        note: 'dob mismatch',
        vendorBody: { status: 'success', success: true, data: { panStatus: 'valid', dobMatch: false } },
      },
    });
    const result = await service.resolveForCustomer({
      customerId: 1n,
      panNsdlCacheId: null,
      isRecurring: false,
      leadId: 3n,
      ...identity,
    });
    assert.equal(result.source, 'vendor');
    assert.equal(result.cacheUuid, null);
    assert.deepEqual(attached, []);
    assert.equal(vendorCalls.count, 1);
  });
});
