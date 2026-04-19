import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import type { SaveLoanSelectionDto } from '../dto/save-loan-selection.dto';

function parseDateOnlyUtc(raw: string): Date {
  const [y, m, d] = raw.split('-').map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new BadRequestException('Invalid tenure end date.');
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function daysFromToday(endDateUtc: Date): number {
  const now = new Date();
  const startUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const endUtc = Date.UTC(endDateUtc.getUTCFullYear(), endDateUtc.getUTCMonth(), endDateUtc.getUTCDate());
  const ms = endUtc - startUtc;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

@Injectable()
export class SaveLoanSelectionUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsRepository
  ) {}

  async execute(req: Request, dto: SaveLoanSelectionDto): Promise<{ success: true }> {
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

    const loanSettings = await this.settings.loadLoanCalculationSettings();
    if (dto.loanAmount < loanSettings.minLoanAmount || dto.loanAmount > loanSettings.maxLoanAmount) {
      throw new BadRequestException(
        `Loan amount must be between ${loanSettings.minLoanAmount} and ${loanSettings.maxLoanAmount}.`
      );
    }

    const tenureEndDate = parseDateOnlyUtc(dto.tenureEndDate);
    const tenureDays = daysFromToday(tenureEndDate);
    if (tenureDays > 62) {
      throw new BadRequestException('Tenure end date must be within the next 2 months.');
    }

    const interestAmountNum = dto.loanAmount * (loanSettings.roiPerDayPercent / 100) * tenureDays;
    const processingFeeAmountNum = (dto.loanAmount * loanSettings.processingFeePercent) / 100;
    const gstAmountNum = (processingFeeAmountNum * loanSettings.processingFeeGstPercent) / 100;

    await this.prisma.client.$transaction(async (tx) => {
      let application = await tx.application.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!application) {
        const draftStatus = await tx.applicationStatus.findFirst({
          where: { name: 'DRAFT', isActive: true },
          select: { id: true },
        });
        if (!draftStatus) {
          throw new BadRequestException('Application status DRAFT is not configured.');
        }
        application = await tx.application.create({
          data: {
            customerId: customer.id,
            leadId: lead.id,
            applicationStatusId: draftStatus.id,
          },
        });
      }

      await tx.applicationDetails.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          loanAmount: new Prisma.Decimal(dto.loanAmount),
          loanTenure: tenureDays,
          interestRate: new Prisma.Decimal(loanSettings.roiPerDayPercent),
          interestAmount: new Prisma.Decimal(interestAmountNum),
          processingFee: new Prisma.Decimal(loanSettings.processingFeePercent),
          processingFeeAmount: new Prisma.Decimal(processingFeeAmountNum),
          gstAmount: new Prisma.Decimal(gstAmountNum),
          loanMaturityDate: tenureEndDate,
          loanDisbursementDate: new Date(),
        },
        update: {
          loanAmount: new Prisma.Decimal(dto.loanAmount),
          loanTenure: tenureDays,
          interestRate: new Prisma.Decimal(loanSettings.roiPerDayPercent),
          interestAmount: new Prisma.Decimal(interestAmountNum),
          processingFee: new Prisma.Decimal(loanSettings.processingFeePercent),
          processingFeeAmount: new Prisma.Decimal(processingFeeAmountNum),
          gstAmount: new Prisma.Decimal(gstAmountNum),
          loanMaturityDate: tenureEndDate,
          loanDisbursementDate: new Date(),
        },
      });
    });

    return { success: true };
  }
}

