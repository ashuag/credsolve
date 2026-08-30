import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { LosLoanRepaymentSyncService } from '../../../los/services/los-loan-repayment-sync.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class RefreshCustomerRepaymentUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly prisma: PrismaService,
    private readonly repaymentSync: LosLoanRepaymentSyncService,
  ) {}

  async execute(req: Request, applicationUuid: string) {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const application = await this.prisma.client.application.findFirst({
      where: { uuid: applicationUuid, customerId: customer.id },
      select: {
        uuid: true,
        loanAccount: { select: { uuid: true } },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found.');
    }
    if (!application.loanAccount) {
      throw new ForbiddenException('No loan account exists for this application.');
    }

    return this.repaymentSync.refreshPayment(application.loanAccount.uuid);
  }
}
