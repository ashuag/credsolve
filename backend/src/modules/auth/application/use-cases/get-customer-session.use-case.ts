import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  formatLeadDetailForPortal,
  isLeadEmailVerifiedForPortal,
} from '../../../../common/mappers/customer-portal-profile.mapper';
import type { CustomerSessionResult } from '../contracts/customer-session-result.contract';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';

@Injectable()
export class GetCustomerSessionUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository
  ) {}

  async execute(req: Request): Promise<CustomerSessionResult> {
    const session = req.customerSession;
    if (!session) {
      return { authenticated: false };
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      return { authenticated: false };
    }

    const leadRow = await this.leads.findActiveByCustomerId(undefined, customer.id);
    if (!leadRow) {
      return {
        authenticated: true,
        customerId: customer.uuid,
        mobileNumber: customer.mobileNumber,
        lead: null,
        profile: null,
      };
    }

    const statusName = leadRow.leadStatus.name;
    const emailVerified = isLeadEmailVerifiedForPortal(
      statusName,
      leadRow.email,
      leadRow.emailVerificationType
    );

    const profile = formatLeadDetailForPortal(leadRow.leadDetail);

    return {
      authenticated: true,
      customerId: customer.uuid,
      mobileNumber: customer.mobileNumber,
      lead: {
        uuid: leadRow.uuid,
        status: statusName,
        email: leadRow.email,
        emailVerified,
      },
      profile,
    };
  }
}
