import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ParsedTenacioBureauFields } from '../../../../common/vendor/tenacio-bureau-payload.mapper';
import { PrismaService } from '../../../../prisma/prisma.service';

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

    return this.prisma.client.$transaction(async (tx) => {
      const row = await tx.bureauReport.create({
        data: {
          customerId: params.customerId,
          cibilScore: params.parsed.bureauScore,
          vendorRequestId: params.parsed.vendorRequestId,
          serviceStatusCode: params.httpStatus,
          responseStatus: params.parsed.responseStatus,
          rawPayload,
          dummyFetched: Boolean(params.dummyFetched),
        },
        select: { id: true, uuid: true },
      });
      await tx.leadDetail.updateMany({
        where: { leadId: params.leadId },
        data: { bureauReportId: row.id },
      });
      return row;
    });
  }

  /**
   * Latest bureau snapshot for this customer (any lead). Recurring re-applies
   * use this to decide reuse vs refetch.
   */
  async findLatestForCustomer(customerId: bigint): Promise<{
    id: bigint;
    uuid: string;
    createdAt: Date;
    rawPayload: unknown;
    dummyFetched: boolean | null;
    serviceStatusCode: number | null;
  } | null> {
    return this.prisma.client.bureauReport.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        createdAt: true,
        rawPayload: true,
        dummyFetched: true,
        serviceStatusCode: true,
      },
    });
  }

  async findAttachedForLead(leadId: bigint): Promise<{
    id: bigint;
    uuid: string;
    cibilScore: number | null;
    createdAt: Date;
    rawPayload: unknown;
  } | null> {
    const row = await this.prisma.client.leadDetail.findUnique({
      where: { leadId },
      select: {
        bureauReport: {
          select: {
            id: true,
            uuid: true,
            cibilScore: true,
            createdAt: true,
            rawPayload: true,
          },
        },
      },
    });
    return row?.bureauReport ?? null;
  }

  async findLatestForLead(leadId: bigint): Promise<{
    id: bigint;
    uuid: string;
    cibilScore: number | null;
    createdAt: Date;
  } | null> {
    const attached = await this.findAttachedForLead(leadId);
    if (!attached) return null;
    return {
      id: attached.id,
      uuid: attached.uuid,
      cibilScore: attached.cibilScore,
      createdAt: attached.createdAt,
    };
  }

  async findLatestRawPayloadForLead(leadId: bigint): Promise<unknown | null> {
    return (await this.findAttachedForLead(leadId))?.rawPayload ?? null;
  }

  async findLatestBureauScoreForLead(leadId: bigint): Promise<number | null> {
    return (await this.findAttachedForLead(leadId))?.cibilScore ?? null;
  }
}
