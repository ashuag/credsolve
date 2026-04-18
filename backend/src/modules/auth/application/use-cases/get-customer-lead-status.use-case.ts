import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';

@Injectable()
export class GetCustomerLeadStatusUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository
  ) {}

  async execute(req: Request): Promise<{ leadId: string | null; leadStatus: string | null }> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      return { leadId: null, leadStatus: null };
    }

    const lead = await this.leads.findActiveByCustomerId(undefined, customer.id);
    if (!lead) {
      return { leadId: null, leadStatus: null };
    }

    return {
      leadId: lead.uuid,
      leadStatus: lead.leadStatus.name,
    };
  }
}
