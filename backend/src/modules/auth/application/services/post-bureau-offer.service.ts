import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PostBreCheckService } from '../../../../common/bre/post-bre-check.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import { BureauReportRepository } from '../../infrastructure/repositories/bureau-report.repository';
import { CheckLoanEligibilityUseCase } from '../use-cases/check-loan-eligibility.use-case';

@Injectable()
export class PostBureauOfferService {
  private readonly logger = new Logger(PostBureauOfferService.name);

  constructor(
    private readonly postBreCheck: PostBreCheckService,
    private readonly checkLoanEligibility: CheckLoanEligibilityUseCase,
    private readonly applications: ApplicationRepository,
    private readonly bureauReports: BureauReportRepository,
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
  }): Promise<void> {
    const postBre = await this.postBreCheck.run({ leadId: params.leadId });
    if (!postBre.passed) {
      this.logger.debug(
        `Post-BRE did not pass (leadId=${params.leadId.toString()}): ${postBre.rejectReason ?? 'no reason'}`,
      );
      return;
    }

    const { preApprovedAmountInr } = this.checkLoanEligibility.computeForSeed(params.leadUuid);
    const approved = new Prisma.Decimal(preApprovedAmountInr);
    const cibilScore = await this.bureauReports.findLatestBureauScoreForLead(params.leadId);

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
          checkedAt: new Date(),
        },
      });
    });
  }
}
