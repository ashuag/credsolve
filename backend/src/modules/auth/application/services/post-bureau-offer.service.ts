import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PostBreCheckService } from '../../../../common/bre/post-bre-check.service';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import { CheckLoanEligibilityUseCase } from '../use-cases/check-loan-eligibility.use-case';

export type PostBureauOfferResult =
  | { ok: true }
  | {
      ok: false;
      rejectReason: string;
      rejectionReasonCode: string;
      cibilScore: number | null;
    };

@Injectable()
export class PostBureauOfferService {
  private readonly logger = new Logger(PostBureauOfferService.name);

  constructor(
    private readonly postBreCheck: PostBreCheckService,
    private readonly checkLoanEligibility: CheckLoanEligibilityUseCase,
    private readonly applications: ApplicationRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * After bureau data is available: run post-BRE, then persist a draft application
   * with deterministic pre-approved ceiling (same seed as `/loans/eligibility`).
   */
  async runAfterSuccessfulBureauFetch(params: {
    leadId: bigint;
    customerId: bigint;
    leadUuid: string;
  }): Promise<PostBureauOfferResult> {
    const postBre = await this.postBreCheck.run({
      leadId: params.leadId,
      customerId: params.customerId,
    });

    if (!postBre.passed) {
      this.logger.debug(
        `Post-BRE did not pass (leadId=${params.leadId.toString()}): ${postBre.rejectReason ?? 'no reason'}`,
      );
      await this.rejectLeadAndApplication({
        leadId: params.leadId,
        customerId: params.customerId,
        note: postBre.rejectReason ?? 'Post-BRE check failed',
        rejectionReasonCode: postBre.rejectionReasonCode,
        cibilScore: postBre.cibilScore,
        ineligibleReason: postBre.rejectReason,
      });
      return {
        ok: false,
        rejectReason: postBre.rejectReason ?? 'Post-BRE check failed',
        rejectionReasonCode: postBre.rejectionReasonCode ?? 'REJECTED_BY_CLIENTS',
        cibilScore: postBre.cibilScore,
      };
    }

    const { preApprovedAmountInr } = await this.checkLoanEligibility.computeForLead(params.leadId);
    const approved = new Prisma.Decimal(preApprovedAmountInr);
    const cibilScore = postBre.cibilScore;

    const convertedLeadStatus = await this.prisma.client.leadStatus.findFirst({
      where: { name: LEAD_STATUS.CONVERTED, isActive: true },
      select: { id: true },
    });
    if (!convertedLeadStatus) {
      this.logger.warn('LeadStatus CONVERTED not found — application will be created but lead stays unchanged.');
    }

    await this.prisma.client.$transaction(async (tx) => {
      const application = await this.applications.ensureDraftApplicationForLead(
        { leadId: params.leadId, customerId: params.customerId },
        tx,
      );

      await tx.application.update({
        where: { id: application.id },
        data: { preApprovedLoanAmount: approved },
      });

      await tx.applicationEligibility.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          isEligible: true,
          approvedAmount: approved,
          cibilScore,
        },
        update: {
          isEligible: true,
          approvedAmount: approved,
          cibilScore,
          ineligibleReason: null,
          checkedAt: new Date(),
        },
      });

      if (convertedLeadStatus) {
        await tx.lead.update({
          where: { id: params.leadId },
          data: { leadStatusId: convertedLeadStatus.id },
        });
      }
    });

    this.logger.log(
      `Post-BRE passed (leadId=${params.leadId.toString()}): draft application ensured, lead set to CONVERTED.`,
    );

    return { ok: true };
  }

  private async rejectLeadAndApplication(params: {
    leadId: bigint;
    customerId: bigint;
    note: string;
    rejectionReasonCode: string | null;
    cibilScore: number | null;
    ineligibleReason: string | null;
  }): Promise<void> {
    const [rejectedLeadStatus, rejectedAppStatus, rejectionReason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      params.rejectionReasonCode
        ? this.prisma.client.rejectionReason.findFirst({
            where: { name: params.rejectionReasonCode, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!rejectedLeadStatus) {
      this.logger.warn('LeadStatus REJECTED not found — skipping post-BRE lead rejection.');
      return;
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: params.leadId },
        data: {
          leadStatusId: rejectedLeadStatus.id,
          leadStatusNote: params.note.slice(0, 256),
          ...(rejectionReason ? { rejectionReasonId: rejectionReason.id } : {}),
        },
      });

      const application = await this.applications.ensureDraftApplicationForLead(
        { leadId: params.leadId, customerId: params.customerId },
        tx,
      );

      if (rejectedAppStatus) {
        await tx.application.update({
          where: { id: application.id },
          data: { applicationStatusId: rejectedAppStatus.id },
        });
      }

      await tx.applicationEligibility.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          isEligible: false,
          approvedAmount: null,
          cibilScore: params.cibilScore,
          ineligibleReason: params.ineligibleReason?.slice(0, 500) ?? params.note.slice(0, 500),
        },
        update: {
          isEligible: false,
          approvedAmount: null,
          cibilScore: params.cibilScore,
          ineligibleReason: params.ineligibleReason?.slice(0, 500) ?? params.note.slice(0, 500),
          checkedAt: new Date(),
        },
      });
    });
  }
}
