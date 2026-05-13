import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DigilockerVendorService } from '../../../../common/vendor/digilocker-vendor.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';

export type InitDigilockerResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
};

@Injectable()
export class InitDigilockerUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly digilocker: DigilockerVendorService,
  ) {}

  async execute(req: Request): Promise<InitDigilockerResult> {
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

    const out = await this.digilocker.postInit({ input: {} }, lead.id);

    return {
      configured: out.configured,
      skipReason: out.skipReason,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendor: out.vendorBody ?? null,
    };
  }
}
