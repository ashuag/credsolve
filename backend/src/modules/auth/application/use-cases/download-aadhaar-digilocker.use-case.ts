import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DigilockerVendorService } from '../../../../common/vendor/digilocker-vendor.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { DownloadAadhaarDigilockerDto } from '../dto/download-aadhaar-digilocker.dto';

export type DownloadAadhaarDigilockerResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
};

@Injectable()
export class DownloadAadhaarDigilockerUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly digilocker: DigilockerVendorService,
  ) {}

  async execute(req: Request, dto: DownloadAadhaarDigilockerDto): Promise<DownloadAadhaarDigilockerResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lead = await this.leads.findActiveByCustomerId(customer.id);
    if (!lead) {
      throw new BadRequestException('No active loan application was found for your account.');
    }

    const consent = dto.consent !== false;
    const out = await this.digilocker.postAadhaarDownload(
      { input: { sessionToken: dto.sessionToken.trim(), consent } },
      lead.id,
    );

    return {
      configured: out.configured,
      skipReason: out.skipReason,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendor: out.vendorBody ?? null,
    };
  }
}
