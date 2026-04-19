import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { BankRepository } from '../../infrastructure/repositories/bank.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { SaveBankDetailsDto } from '../dto/save-bank-details.dto';

@Injectable()
export class SaveBankDetailsUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly banks: BankRepository,
    private readonly prisma: PrismaService
  ) {}

  async execute(req: Request, dto: SaveBankDetailsDto): Promise<{ success: true }> {
    const normalizedBankName = dto.bankName.trim();
    const validBank = await this.banks.isActiveBankName(normalizedBankName);
    if (!validBank) {
      throw new BadRequestException('Please select a valid bank from the list.');
    }

    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lead = await this.leads.findActiveSummaryForCustomer(undefined, customer.id);
    if (!lead) {
      throw new NotFoundException('No active lead found.');
    }

    await this.prisma.client.$transaction(async (tx) => {
      const application = await tx.application.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, applicationStatusId: true },
      });
      if (!application) {
        throw new BadRequestException('Create application details before bank details.');
      }

      const details = await tx.applicationDetails.findUnique({
        where: { applicationId: application.id },
        select: { loanAmount: true },
      });
      const disbursementAmount = details?.loanAmount ?? null;

      await tx.applicationDisbursement.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          amount: disbursementAmount ? new Prisma.Decimal(disbursementAmount.toString()) : null,
          accountNumber: dto.accountNumber,
          ifscCode: dto.ifscCode.toUpperCase(),
          disbursedAt: null,
        },
        update: {
          amount: disbursementAmount ? new Prisma.Decimal(disbursementAmount.toString()) : null,
          accountNumber: dto.accountNumber,
          ifscCode: dto.ifscCode.toUpperCase(),
        },
      });

      // `bank_name` is written via raw SQL so the DB stays compatible even when the column was added after the initial migration.
      await tx.$executeRaw`
        UPDATE application_disbursement
        SET bank_name = ${normalizedBankName}
        WHERE application_id = ${application.id}
      `;
    });

    return { success: true };
  }
}

