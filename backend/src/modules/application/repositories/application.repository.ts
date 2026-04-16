import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

export type ApplicationProgressRow = {
  id: bigint;
  uuid: string;
  applicationStatus: string;
  kycCompletedAt: Date | null;
  eligibility: {
    isEligible: boolean;
    approvedAmount: number | null;
    cibilScore: number | null;
    ineligibleReason: string | null;
  } | null;
  details: {
    reasonForLoanId: number | null;
    loanAmount: number | null;
  } | null;
};

@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUuidByLeadUuid(leadUuid: string, session?: DatabaseSession): Promise<string | undefined> {
    const client = session?.tx ?? this.prisma;
    const row = await client.application.findFirst({
      where: {
        lead: {
          uuid: leadUuid
        }
      },
      select: { uuid: true }
    });

    return row?.uuid;
  }

  async findByLeadUuid(leadUuid: string, session?: DatabaseSession): Promise<{ id: bigint; uuid: string } | undefined> {
    const client = session?.tx ?? this.prisma;
    const row = await client.application.findFirst({
      where: {
        lead: {
          uuid: leadUuid
        }
      },
      select: {
        id: true,
        uuid: true
      }
    });

    return row ?? undefined;
  }

  async findProgressByLeadUuid(leadUuid: string, session?: DatabaseSession): Promise<ApplicationProgressRow | undefined> {
    const client = session?.tx ?? this.prisma;
    const row = await client.application.findFirst({
      where: {
        lead: {
          uuid: leadUuid
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        uuid: true,
        kycCompletedAt: true,
        applicationStatus: {
          select: {
            name: true
          }
        },
        eligibility: {
          select: {
            isEligible: true,
            approvedAmount: true,
            cibilScore: true,
            ineligibleReason: true
          }
        },
        details: {
          select: {
            reasonForLoanId: true,
            loanAmount: true
          }
        }
      }
    });

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      uuid: row.uuid,
      applicationStatus: row.applicationStatus.name,
      kycCompletedAt: row.kycCompletedAt ?? null,
      eligibility: row.eligibility
        ? {
            isEligible: row.eligibility.isEligible,
            approvedAmount: row.eligibility.approvedAmount === null ? null : Number(row.eligibility.approvedAmount),
            cibilScore: row.eligibility.cibilScore ?? null,
            ineligibleReason: row.eligibility.ineligibleReason ?? null
          }
        : null,
      details: row.details
        ? {
            reasonForLoanId: row.details.reasonForLoanId ?? null,
            loanAmount: row.details.loanAmount === null ? null : Number(row.details.loanAmount)
          }
        : null
    };
  }

  async updateStatusById(id: bigint, statusId: number, session?: DatabaseSession): Promise<void> {
    const client = session?.tx ?? this.prisma;
    await client.application.update({
      where: { id },
      data: { applicationStatusId: statusId }
    });
  }

  async create(params: {
    uuid: string;
    customerId: bigint;
    leadUuid: string;
    statusId: number;
  }, session?: DatabaseSession): Promise<void> {
    const client = session?.tx ?? this.prisma;
    const lead = await client.lead.findUnique({
      where: { uuid: params.leadUuid },
      select: { id: true }
    });

    if (!lead) {
      return;
    }

    await client.application.create({
      data: {
        uuid: params.uuid,
        customerId: params.customerId,
        leadId: lead.id,
        applicationStatusId: params.statusId
      }
    });
  }
}
