import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  detailsFromIfscRow,
  extractVendorIfscData,
  mapIfscDataToFields,
} from '../../../../common/ifsc/ifsc-code.util';
import { CredostackIfscService } from '../../../../common/vendor/credostack/credostack-ifsc.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { IfscCodeRepository } from '../../infrastructure/repositories/ifsc-code.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { LookupIfscDto } from '../dto/lookup-ifsc.dto';

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
    private readonly ifscVendor: CredostackIfscService,
    private readonly customers: CustomerRepository,
    private readonly ifscCodes: IfscCodeRepository,
    private readonly leads: LeadRepository,
  ) {}

  async execute(req: Request, dto: LookupIfscDto): Promise<LookupIfscResult> {
    const ifsc = dto.ifscNumber.trim().toUpperCase();

    const cached = await this.ifscCodes.findByIfscCode(ifsc);
    if (cached) {
      return {
        configured: true,
        ok: true,
        httpStatus: 200,
        details: detailsFromIfscRow(cached),
        vendor: null,
      };
    }

    let leadId: bigint | null = null;
    const session = req.customerSession;
    if (session) {
      const customer = await this.customers.findByUuid(undefined, session.sub);
      if (customer) {
        const lead = await this.leads.findActiveSummaryForCustomer(customer.id);
        leadId = lead?.id ?? null;
      }
    }

    const out = await this.ifscVendor.lookupIfsc(ifsc, leadId);

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
    const vendorData = extractVendorIfscData(vendor);
    if (out.ok && vendorData) {
      const fields = mapIfscDataToFields(ifsc, vendorData);
      if (fields.bankName.length > 0) {
        await this.ifscCodes.upsertFromLookup(fields);
        return {
          configured: true,
          ok: true,
          httpStatus: out.httpStatus,
          details: detailsFromIfscRow(fields),
          vendor,
        };
      }
    }

    return {
      configured: true,
      ok: false,
      httpStatus: out.httpStatus,
      details: null,
      vendor,
    };
  }
}
