import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

@Injectable()
export class ApplicationEligibilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByApplicationId(applicationId: bigint, session?: DatabaseSession): Promise<{
    isEligible: boolean;
    approvedAmount: number | null;
    cibilScore: number | null;
    ineligibleReason: string | null;
  } | null> {
    const client = session?.tx ?? this.prisma;
    const row = await client.applicationEligibility.findUnique({
      where: { applicationId },
      select: {
        isEligible: true,
        approvedAmount: true,
        cibilScore: true,
        ineligibleReason: true
      }
    });

    if (!row) {
      return null;
    }

    return {
      isEligible: row.isEligible,
      approvedAmount: row.approvedAmount === null ? null : Number(row.approvedAmount),
      cibilScore: row.cibilScore ?? null,
      ineligibleReason: row.ineligibleReason ?? null
    };
  }

  async upsert(params: {
    applicationId: bigint;
    isEligible: boolean;
    approvedAmount?: number;
    cibilScore?: number;
    ineligibleReason?: string;
  }, session?: DatabaseSession): Promise<void> {
    const client = session?.tx ?? this.prisma;
    await client.applicationEligibility.upsert({
      where: { applicationId: params.applicationId },
      update: {
        isEligible: params.isEligible,
        approvedAmount: params.approvedAmount ?? null,
        cibilScore: params.cibilScore ?? null,
        ineligibleReason: params.ineligibleReason ?? null,
        checkedAt: new Date(),
      },
      create: {
        applicationId: params.applicationId,
        isEligible: params.isEligible,
        approvedAmount: params.approvedAmount ?? null,
        cibilScore: params.cibilScore ?? null,
        ineligibleReason: params.ineligibleReason ?? null,
      },
    });
  }
}
