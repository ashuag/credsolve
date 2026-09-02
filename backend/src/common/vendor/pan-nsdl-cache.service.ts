import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PAN_VERIFIED } from '../constants/pan-verification.constants';
import { PanNsdlCacheRepository, type PanNsdlCacheRow } from './pan-nsdl-cache.repository';
import {
  isPanAndDobVerifiedForCache,
  panNsdlIdentitiesEqual,
  toIsoDateOnlyUtc,
} from './pan-nsdl-cache.util';
import {
  PanVerificationService,
  type PanVerificationResult,
} from './pan-verification.service';

export type PanNsdlResolveSource = 'customer_cache' | 'identity_cache' | 'vendor';

export type PanNsdlResolveResult = PanVerificationResult & {
  source: PanNsdlResolveSource;
  cacheUuid: string | null;
};

@Injectable()
export class PanNsdlCacheService {
  private readonly logger = new Logger(PanNsdlCacheService.name);

  constructor(
    private readonly cache: PanNsdlCacheRepository,
    private readonly panVerification: PanVerificationService,
  ) {}

  /**
   * Recurring customers with `customer.pan_nsdl_cache_id` skip Tenacio.
   * Everyone else looks up pan+name+DOB; miss calls NSDL and inserts only
   * when pan is valid and DOB matches.
   */
  async resolveForCustomer(input: {
    customerId: bigint;
    panNsdlCacheId: bigint | null;
    isRecurring: boolean;
    panNumber: string;
    fullName: string;
    dateOfBirth: Date;
    leadId: bigint;
  }): Promise<PanNsdlResolveResult> {
    const identity = {
      panNumber: input.panNumber,
      fullName: input.fullName,
      dateOfBirth: input.dateOfBirth,
    };

    if (input.isRecurring && input.panNsdlCacheId != null) {
      const byCustomer = await this.cache.findById(input.panNsdlCacheId);
      if (byCustomer && panNsdlIdentitiesEqual(byCustomer, identity)) {
        await this.cache.attachToCustomer(input.customerId, byCustomer.id);
        this.logger.debug(
          `PAN NSDL cache hit via customer (leadId=${input.leadId.toString()} uuid=${byCustomer.uuid})`,
        );
        return this.fromCacheRow(byCustomer, 'customer_cache');
      }
    }

    const byIdentity = await this.cache.findByIdentity(identity);
    if (byIdentity) {
      await this.cache.attachToCustomer(input.customerId, byIdentity.id);
      this.logger.debug(
        `PAN NSDL cache hit via identity (leadId=${input.leadId.toString()} uuid=${byIdentity.uuid})`,
      );
      return this.fromCacheRow(byIdentity, 'identity_cache');
    }

    const vendor = await this.panVerification.verifyWithVendor({
      leadId: input.leadId,
      panNumber: identity.panNumber,
      fullName: identity.fullName,
      dobIso: toIsoDateOnlyUtc(identity.dateOfBirth),
    });

    if (isPanAndDobVerifiedForCache(vendor) && vendor.vendorBody != null) {
      const row = await this.cache.upsertVerifiedIdentity({
        ...identity,
        nsdlResponse: vendor.vendorBody as Prisma.InputJsonValue,
        nameVerified: vendor.nameMatch,
        vendorRequestId: vendor.vendorRequestId,
      });
      await this.cache.attachToCustomer(input.customerId, row.id);
      this.logger.debug(
        `PAN NSDL cache stored (leadId=${input.leadId.toString()} uuid=${row.uuid})`,
      );
      return { ...vendor, source: 'vendor', cacheUuid: row.uuid };
    }

    return { ...vendor, source: 'vendor', cacheUuid: null };
  }

  /** Attach the customer to an existing cache row without calling NSDL. */
  async linkCustomerIfCached(input: {
    customerId: bigint;
    panNumber: string;
    fullName: string;
    dateOfBirth: Date;
  }): Promise<void> {
    const row = await this.cache.findByIdentity(input);
    if (!row) return;
    await this.cache.attachToCustomer(input.customerId, row.id);
  }

  private fromCacheRow(row: PanNsdlCacheRow, source: PanNsdlResolveSource): PanNsdlResolveResult {
    const parsed = this.panVerification.resultFromVendorBody(row.nsdlResponse);
    if (
      parsed.panVerifiedStatus === PAN_VERIFIED.VERIFIED ||
      parsed.panVerifiedStatus === PAN_VERIFIED.NOT_VERIFIED
    ) {
      return {
        ...parsed,
        nameMatch: row.nameVerified,
        source,
        cacheUuid: row.uuid,
      };
    }

    const category = extractCategory(row.nsdlResponse);
    const journeyVerified = category === 'Individual';
    return {
      panVerifiedStatus: journeyVerified ? PAN_VERIFIED.VERIFIED : PAN_VERIFIED.NOT_VERIFIED,
      nameMatch: row.nameVerified,
      dobMatch: true,
      panStatus: 'valid',
      category,
      vendorRequestId: row.vendorRequestId,
      note: journeyVerified ? null : `cached pan+dob; category=${category}`,
      source,
      cacheUuid: row.uuid,
    };
  }
}

function extractCategory(body: Prisma.JsonValue): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.category === 'string') return record.category;
  const data = record.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const category = (data as Record<string, unknown>).category;
    if (typeof category === 'string') return category;
  }
  return null;
}
