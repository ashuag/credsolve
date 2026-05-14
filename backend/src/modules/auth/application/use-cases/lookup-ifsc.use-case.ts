import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { BankTenacioVendorService } from '../../../../common/vendor/bank-tenacio-vendor.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { LookupIfscDto } from '../dto/lookup-ifsc.dto';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export type LookupIfscResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  details: Record<string, unknown> | null;
  vendor: unknown | null;
};

@Injectable()
export class LookupIfscUseCase {
  constructor(
    private readonly bankVendor: BankTenacioVendorService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
  ) {}

  async execute(req: Request, dto: LookupIfscDto): Promise<LookupIfscResult> {
    const ifsc = dto.ifscNumber.trim().toUpperCase();

    let leadId: bigint | null = null;
    const session = req.customerSession;
    if (session) {
      const customer = await this.customers.findByUuid(undefined, session.sub);
      if (customer) {
        const lead = await this.leads.findActiveSummaryForCustomer(customer.id);
        leadId = lead?.id ?? null;
      }
    }

    const out = await this.bankVendor.postIfscLookup(
      { input: { ifscNumber: ifsc, consent: true } },
      leadId,
    );

    if (!out.configured) {
      return {
        configured: false,
        skipReason: out.skipReason,
        ok: false,
        httpStatus: out.httpStatus,
        details: null,
        vendor: out.vendorBody ?? null,
      };
    }

    const vendor = out.vendorBody ?? null;
    const details = extractIfscData(vendor);

    return {
      configured: true,
      ok: out.ok,
      httpStatus: out.httpStatus,
      details,
      vendor,
    };
  }
}

function extractIfscData(vendor: unknown): Record<string, unknown> | null {
  if (!isRecord(vendor)) return null;
  const data = vendor.data;
  if (isRecord(data)) {
    return data;
  }
  return null;
}
