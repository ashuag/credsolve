import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
    const normalizedBankName = dto.bankName?.trim() ?? '';
    if (normalizedBankName) {
      const validBank = await this.banks.isActiveBankName(normalizedBankName);
      if (!validBank) {
        throw new BadRequestException('Please select a valid bank from the list.');
      }
    }

    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lead = await this.leads.findActiveSummaryForCustomer(customer.id);
    if (!lead) {
      throw new NotFoundException('No active lead found.');
    }

    await this.prisma.client.$transaction(async (tx) => {
      const application = await tx.application.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!application) {
        throw new BadRequestException('Create loan details before bank details.');
      }

      const updated = await tx.applicationDetail.updateMany({
        where: { applicationId: application.id },
        data: {
          bankAccountNumber: dto.accountNumber,
          ifscCode: dto.ifscCode.toUpperCase(),
          bankName: normalizedBankName.length > 0 ? normalizedBankName : null,
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException('Complete loan selection before bank details.');
      }
    });

    return { success: true };
  }
}
