import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DigilockerSessionStore } from '../../../../common/kyc/digilocker-session.store';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';

export type GetPendingDigilockerSessionResult = {
  sessionToken: string | null;
};

@Injectable()
export class GetPendingDigilockerSessionUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly digilockerSession: DigilockerSessionStore,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request): Promise<GetPendingDigilockerSessionResult> {
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

    await assertActiveApplicationLoanDocumentsAccepted(this.prisma.client, {
      leadId: lead.id,
      customerId: customer.id,
    });

    const application = await this.applications.ensureDraftApplicationForLead({
      leadId: lead.id,
      customerId: customer.id,
    });

    const sessionToken = await this.digilockerSession.read(application.uuid);
    return { sessionToken };
  }
}
