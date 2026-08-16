import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeCibilAssessmentSignals, type CibilAssessmentSignals } from './cibil-bureau-rules.parser';
import { runCibilCreditAssessment, type CibilCreditAssessmentResult } from './cibil-credit-assessment.engine';

export type CibilCreditAssessmentRow = CibilCreditAssessmentResult & {
  bureauReportId: bigint;
  signals: CibilAssessmentSignals;
};

/** API-safe view of a persisted assessment (no bigint id — callers already have the bureau report uuid). */
export type CibilCreditAssessmentView = CibilCreditAssessmentResult & {
  signals: CibilAssessmentSignals;
};

/**
 * Rule-based CIBIL credit assessment (category, hard-underwriting decision, payment
 * probability) — runs on the raw bureau payload right after a bureau pull, before
 * post-BRE. Persists its output to `cibil_credit_assessment`; does not gate the pipeline.
 */
@Injectable()
export class CibilCreditAssessmentService {
  private readonly logger = new Logger(CibilCreditAssessmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs the assessment for a lead's latest bureau report and persists the result. */
  async runForLead(leadId: bigint): Promise<CibilCreditAssessmentRow | null> {
    const bureauRow = await this.findLatestBureauReport(leadId);
    if (!bureauRow?.rawPayload) {
      this.logger.warn(`CIBIL credit assessment skipped (leadId=${leadId.toString()}): no bureau raw payload.`);
      return null;
    }
    return this.runForBureauReport(bureauRow.id, bureauRow.cibilScore, bureauRow.rawPayload);
  }

  async runForBureauReport(
    bureauReportId: bigint,
    riskScore: number | null,
    rawPayload: unknown,
  ): Promise<CibilCreditAssessmentRow> {
    const signals = computeCibilAssessmentSignals(rawPayload, riskScore);
    const result = runCibilCreditAssessment(signals);

    await this.persist(bureauReportId, signals, result);

    this.logger.log(
      `CIBIL credit assessment (bureauReportId=${bureauReportId.toString()}): category=${result.category} ` +
        `creditStatus=${result.creditStatus} paymentProbabilityPct=${result.paymentProbabilityPct} ` +
        `creditRecommendation=${result.creditRecommendation}`,
    );

    return { ...result, bureauReportId, signals };
  }

  /** Reads the persisted assessment for a bureau report, if one has been computed. */
  async getViewForBureauReportId(bureauReportId: bigint): Promise<CibilCreditAssessmentView | null> {
    const row = await this.prisma.client.cibilCreditAssessment.findUnique({ where: { bureauReportId } });
    if (!row) return null;

    return {
      category: row.category as CibilCreditAssessmentResult['category'],
      categoryDescription: row.categoryDescription,
      creditStatus: row.creditStatus as CibilCreditAssessmentResult['creditStatus'],
      rejectionReasons: row.rejectionReasons,
      paymentProbabilityPct: row.paymentProbabilityPct.toNumber(),
      creditRecommendation: row.creditRecommendation as CibilCreditAssessmentResult['creditRecommendation'],
      recommendationRejectionReason: row.recommendationRejectionReason,
      signals: row.metricsSnapshot as unknown as CibilAssessmentSignals,
    };
  }

  private async persist(
    bureauReportId: bigint,
    signals: CibilAssessmentSignals,
    result: CibilCreditAssessmentResult,
  ): Promise<void> {
    const client = this.prisma.client as unknown as {
      cibilCreditAssessment: {
        upsert: (args: {
          where: { bureauReportId: bigint };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => Promise<unknown>;
      };
    };

    const data = {
      riskScore: signals.riskScore,
      category: result.category,
      categoryDescription: result.categoryDescription,
      creditStatus: result.creditStatus,
      rejectionReasons: result.rejectionReasons,
      paymentProbabilityPct: result.paymentProbabilityPct,
      creditRecommendation: result.creditRecommendation,
      recommendationRejectionReason: result.recommendationRejectionReason,
      metricsSnapshot: signals as unknown as Record<string, unknown>,
    };

    await client.cibilCreditAssessment.upsert({
      where: { bureauReportId },
      create: { bureauReportId, ...data },
      update: data,
    });
  }

  private async findLatestBureauReport(leadId: bigint): Promise<{
    id: bigint;
    cibilScore: number | null;
    rawPayload: unknown;
  } | null> {
    const client = this.prisma.client as unknown as {
      bureauReport: {
        findFirst: (args: {
          where: { leadId: bigint };
          orderBy: { createdAt: 'desc' };
          select: { id: true; cibilScore: true; rawPayload: true };
        }) => Promise<{ id: bigint; cibilScore: number | null; rawPayload: unknown } | null>;
      };
    };
    return client.bureauReport.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, cibilScore: true, rawPayload: true },
    });
  }
}
