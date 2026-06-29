import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import { CheckLoanEligibilityUseCase } from './check-loan-eligibility.use-case';
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
    private readonly settings: SettingsRepository,
    private readonly checkLoanEligibility: CheckLoanEligibilityUseCase,
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

    const lead = await this.leads.findActiveSummaryForCustomer(customer.id);
    if (!lead) {
      throw new NotFoundException('No active lead found.');
    }

    const loanSettings = await this.settings.loadLoanCalculationSettings();
    const { preApprovedAmountInr } = await this.checkLoanEligibility.computeForLead(lead.id);
    const maxSelectable = Math.min(loanSettings.maxLoanAmount, preApprovedAmountInr);
    if (dto.loanAmount < loanSettings.minLoanAmount || dto.loanAmount > maxSelectable) {
      throw new BadRequestException(
        `Loan amount must be between ${loanSettings.minLoanAmount} and ${maxSelectable} INR (minimum loan and your pre-approved limit).`,
      );
    }

    const tenureEndDate = parseDateOnlyUtc(dto.tenureEndDate);
    const tenureDays = daysFromToday(tenureEndDate);
    if (tenureDays > 62) {
      throw new BadRequestException('Tenure end date must be within the next 2 months.');
    }

    await this.prisma.client.$transaction(async (tx) => {
      let application = await tx.application.findFirst({
        where: { leadId: lead.id, customerId: customer.id },
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

      const loanPurpose = dto.loanPurpose.trim();
      const reasonForLoan = await tx.reasonForLoan.findFirst({
        where: { name: loanPurpose, isActive: true },
        select: { id: true },
      });
      if (!reasonForLoan) {
        throw new BadRequestException(
          `Loan purpose "${loanPurpose}" is not recognized. Choose a purpose from the list.`,
        );
      }

      const principal = new Prisma.Decimal(dto.loanAmount);
      const detailsCore = {
        selectedLoanAmount: principal,
        interestRate: new Prisma.Decimal(loanSettings.roiPerDayPercent),
        processingFeePercentage: new Prisma.Decimal(loanSettings.processingFeePercent),
        gstPercentage: new Prisma.Decimal(loanSettings.processingFeeGstPercent),
        expectedRepaymentDays: tenureDays,
        expectedRepaymentDate: tenureEndDate,
        reasonForLoanId: reasonForLoan.id,
        bankAccountNumber: null,
        ifscCode: null,
        bankName: null,
      };

      await tx.applicationDetail.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          ...detailsCore,
          emailId: null,
          emailVerificationType: null,
          emailVerifiedAt: null,
          loanDocumentsAcceptedAt: null,
          loanDocumentsAcceptedIp: null,
          keyFactPdfRelativePath: null,
          loanAgreementPdfRelativePath: null,
          keyFactEsigned: false,
          pennyDropAttempts: 0,
          pennyDropVendorJson: Prisma.JsonNull,
        },
        update: {
          ...detailsCore,
          emailId: null,
          emailVerificationType: null,
          emailVerifiedAt: null,
          loanDocumentsAcceptedAt: null,
          loanDocumentsAcceptedIp: null,
          keyFactPdfRelativePath: null,
          loanAgreementPdfRelativePath: null,
          keyFactEsigned: false,
          pennyDropAttempts: 0,
          pennyDropVendorJson: Prisma.JsonNull,
        },
      });

      await tx.applicationReference.deleteMany({
        where: { applicationId: application.id },
      });

      await tx.applicationKyc.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          kycStatus: 0,
          livenessSelfiePath: null,
          isLiveness: false,
          livenessCheckedAt: null,
          livenessDoneAt: null,
          livenessPassed: false,
          livenessVendorJson: Prisma.JsonNull,
          faceMatchCheckedAt: null,
          selfieFaceValidationJson: Prisma.JsonNull,
          selfieFaceValidationPassed: false,
          digilockerAadhaarDownloadAttempts: 0,
          kycCompletedAt: null,
        },
        update: {
          kycStatus: 0,
          livenessSelfiePath: null,
          isLiveness: false,
          livenessCheckedAt: null,
          livenessDoneAt: null,
          livenessPassed: false,
          livenessVendorJson: Prisma.JsonNull,
          faceMatchCheckedAt: null,
          selfieFaceValidationJson: Prisma.JsonNull,
          selfieFaceValidationPassed: false,
          digilockerAadhaarDownloadAttempts: 0,
          kycCompletedAt: null,
        },
      });
    });

    return { success: true };
  }
}
