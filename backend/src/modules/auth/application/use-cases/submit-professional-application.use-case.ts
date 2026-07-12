import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { OCCUPATION } from '../../../../common/constants/occupation.constants';

const OCCUPATION_KEY_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.values(OCCUPATION).map(({ key, name }) => [key, name]),
);
import { parseOptionalInrAmount } from '../../../../common/utils/parse-inr-amount';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { BureauReportRepository } from '../../infrastructure/repositories/bureau-report.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { CheckLoanEligibilityUseCase } from './check-loan-eligibility.use-case';
import type { SaveProfessionalDetailsDto } from '../dto/save-professional-details.dto';


export type SubmitProfessionalApplicationResult = {
  success: true;
  leadUuid: string;
  eligible: boolean;
  approvedAmount: number | null;
  cibilScore: number | null;
};

@Injectable()
export class SubmitProfessionalApplicationUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly prisma: PrismaService,
    private readonly bureauReports: BureauReportRepository,
    private readonly checkLoanEligibility: CheckLoanEligibilityUseCase
  ) {}

  async execute(req: Request, dto: SaveProfessionalDetailsDto): Promise<SubmitProfessionalApplicationResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const leadRow = dto.leadUuid
      ? await this.leads.findByUuidForCustomer(dto.leadUuid, customer.id)
      : await this.leads.findActiveSummaryForCustomer(customer.id);

    if (!leadRow) {
      throw new NotFoundException('No matching active lead was found.');
    }

    const occupationName = OCCUPATION_KEY_TO_NAME[dto.occupation];
    if (!occupationName) {
      throw new BadRequestException('Invalid occupation.');
    }

    const occupation = await this.prisma.client.occupation.findUnique({
      where: { name: occupationName },
      select: { id: true },
    });
    if (!occupation) {
      throw new BadRequestException('Occupation is not available in the system.');
    }

    const netMonthlyIncome = parseOptionalInrAmount(dto.monthlyIncome);
    const annualTurnover = parseOptionalInrAmount(dto.annualTurnover);
    const annualProfit = parseOptionalInrAmount(dto.annualProfit);

    const leadDetailIncomePatch: Prisma.LeadDetailUpdateInput = {
      occupation: { connect: { id: occupation.id } },
    };
    if (dto.monthlyIncome !== undefined) {
      leadDetailIncomePatch.netMonthlyIncome = netMonthlyIncome;
    }
    if (dto.annualTurnover !== undefined) {
      leadDetailIncomePatch.annualTurnover = annualTurnover;
    }
    if (dto.annualProfit !== undefined) {
      leadDetailIncomePatch.annualProfit = annualProfit;
    }

    const { preApprovedAmountInr, minLoanAmountInr } = await this.checkLoanEligibility.computeForLead(leadRow.id);
    const cibilScore = await this.bureauReports.findLatestBureauScoreForLead(leadRow.id);
    const eligible = preApprovedAmountInr >= minLoanAmountInr;

    const [convertedStatus, appStatuses] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.CONVERTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findMany({
        where: {
          name: {
            in: [APPLICATION_STATUS.IN_REVIEW, APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.REJECTED],
          },
          isActive: true,
        },
        select: { id: true, name: true },
      }),
    ]);

    if (!convertedStatus) {
      throw new BadRequestException('Lead status CONVERTED is not configured.');
    }
    const inReviewAppStatus = appStatuses.find((s) => s.name === APPLICATION_STATUS.IN_REVIEW);
    const draftStatus = appStatuses.find((s) => s.name === APPLICATION_STATUS.DRAFT);
    const rejectedAppStatus = appStatuses.find((s) => s.name === APPLICATION_STATUS.REJECTED);
    if (!inReviewAppStatus) {
      throw new BadRequestException('Application status IN_REVIEW is not configured.');
    }
    if (!draftStatus) {
      throw new BadRequestException('Application status DRAFT is not configured.');
    }
    if (!rejectedAppStatus) {
      throw new BadRequestException('Application status REJECTED is not configured.');
    }

    await this.prisma.client.$transaction(async (tx) => {
      const detail = await tx.leadDetail.findUnique({
        where: { leadId: leadRow.id },
        select: { id: true },
      });
      if (!detail) {
        throw new BadRequestException('Complete personal details before professional information.');
      }

      await tx.leadDetail.update({
        where: { leadId: leadRow.id },
        data: leadDetailIncomePatch,
      });

      let application = await tx.application.findFirst({
        where: { leadId: leadRow.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!application) {
        application = await this.applications.createDraftApplication(
          {
            customerId: customer.id,
            leadId: leadRow.id,
            applicationStatusId: draftStatus.id,
          },
          tx,
        );
      }

      await tx.application.update({
        where: { id: application.id },
        data: eligible
          ? {
              applicationStatusId: inReviewAppStatus.id,
              preApprovedLoanAmount: new Prisma.Decimal(preApprovedAmountInr),
              applicationStatusNote: null,
            }
          : {
              applicationStatusId: rejectedAppStatus.id,
              preApprovedLoanAmount: null,
              applicationStatusNote: 'Pre-approved amount is below the minimum loan amount.',
            },
      });

      await tx.lead.update({
        where: { id: leadRow.id },
        data: { leadStatusId: convertedStatus.id },
      });
    });

    return {
      success: true,
      leadUuid: leadRow.uuid,
      eligible,
      approvedAmount: eligible ? preApprovedAmountInr : null,
      cibilScore: eligible ? cibilScore : null,
    };
  }
}
