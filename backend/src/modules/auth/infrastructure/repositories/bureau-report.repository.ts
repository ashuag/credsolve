import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ParsedTenacioBureauFields } from '../../../../common/vendor/tenacio-bureau-payload.mapper';
import { PrismaService } from '../../../../prisma/prisma.service';

/** Persists Tenacio bureau snapshots; requires `prisma generate` after adding `BureauReport` to the schema. */
@Injectable()
export class BureauReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createFromVendorSnapshot(params: {
    customerId: bigint;
    leadId: bigint;
    vendorBody: unknown;
    parsed: ParsedTenacioBureauFields;
    httpStatus: number | null;
    /** Set when bureau data came from mock mode (`BUREAU_FETCH_ENABLED=2`), not live CIBIL. */
    dummyFetched?: boolean;
  }) {
    const rawPayload =
      params.vendorBody === null || params.vendorBody === undefined
        ? undefined
        : (params.vendorBody as Prisma.InputJsonValue);

    const data = {
      customerId: params.customerId,
      leadId: params.leadId,
      cibilScore: params.parsed.bureauScore,
      htmlUrl: params.parsed.htmlUrl,
      vendorRequestId: params.parsed.vendorRequestId,
      serviceStatusCode: params.httpStatus,
      responseStatus: params.parsed.responseStatus,
      rawPayload,
      dummyFetched: Boolean(params.dummyFetched),
    };

    const client = this.prisma.client as unknown as {
      bureauReport: {
        create: (args: {
          data: typeof data;
        }) => Promise<{ id: bigint; uuid: string }>;
      };
    };
    return client.bureauReport.create({ data });
  }

  async findLatestForLead(leadId: bigint): Promise<{
    id: bigint;
    uuid: string;
    cibilScore: number | null;
    htmlUrl: string | null;
    createdAt: Date;
  } | null> {
    return this.prisma.client.bureauReport.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        cibilScore: true,
        htmlUrl: true,
        createdAt: true,
      },
    });
  }

  async findLatestRawPayloadForLead(leadId: bigint): Promise<unknown | null> {
    const client = this.prisma.client as unknown as {
      bureauReport: {
        findFirst: (args: {
          where: { leadId: bigint };
          orderBy: { createdAt: 'desc' };
          select: { rawPayload: true };
        }) => Promise<{ rawPayload: unknown } | null>;
      };
    };
    const row = await client.bureauReport.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: { rawPayload: true },
    });
    return row?.rawPayload ?? null;
  }

  async findLatestBureauScoreForLead(leadId: bigint): Promise<number | null> {
    const client = this.prisma.client as unknown as {
      bureauReport: {
        findFirst: (args: {
          where: { leadId: bigint };
          orderBy: { createdAt: 'desc' };
          select: { cibilScore: true };
        }) => Promise<{ cibilScore: number | null } | null>;
      };
    };
    const row = await client.bureauReport.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: { cibilScore: true },
    });
    return row?.cibilScore ?? null;
  }
}
