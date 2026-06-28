import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from './db.client';

@Injectable()
export class LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: DbClient) {
    return tx ?? this.prisma.client;
  }

  /** Prisma `lead_detail.upsert` — caller supplies full args (no business logic here). */
  upsertLeadDetail(args: any, tx?: DbClient) {
    return this.db(tx).leadDetail.upsert(args);
  }

  /** Prisma `lead.update` — caller supplies full args. */
  updateLead(args: any, tx?: DbClient) {
    return (this.db(tx) as any).lead.update(args);
  }

  /** Prisma `lead.findUnique` — caller supplies full args. */
  findUniqueLead(args: any, tx?: DbClient) {
    return (this.db(tx) as any).lead.findUnique(args);
  }

  findActiveByCustomerId(customerId: bigint, tx?: DbClient) {
    return this.db(tx).lead.findFirst({
      where: { customerId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        leadStatus: { select: { name: true } },
        leadDetail: {
          include: {
            gender: { select: { name: true } },
            occupation: { select: { name: true } },
            city: { select: { name: true, state: { select: { code: true } } } },
          },
        },
      },
    });
  }

  createForCustomer(
    params: { customerId: bigint; leadStatusId: number; expiresAt: Date },
    tx?: DbClient
  ) {
    return this.db(tx).lead.create({
      data: {
        customerId: params.customerId,
        leadStatusId: params.leadStatusId,
        expiresAt: params.expiresAt,
      },
      include: {
        leadStatus: { select: { name: true } },
        leadDetail: {
          include: {
            gender: { select: { name: true } },
            occupation: { select: { name: true } },
            city: { select: { name: true, state: { select: { code: true } } } },
          },
        },
      },
    });
  }

  /**
   * After verified email is persisted (OTP or Google), set lead to IN_PROGRESS.
   * No-op when the lead is already CONVERTED.
   */
  async applyInProgressAfterEmailVerified(
    lead: { id: bigint; leadStatus: { name: string } },
    tx?: DbClient
  ) {
    if (lead.leadStatus.name === LEAD_STATUS.CONVERTED) {
      return;
    }
    const inProgress = await this.db(tx).leadStatus.findFirst({
      where: { name: LEAD_STATUS.IN_PROGRESS, isActive: true },
    });
    if (!inProgress) {
      throw new InternalServerErrorException('Lead status IN_PROGRESS is missing. Run database seeds.');
    }
    return this.db(tx).lead.update({
      where: { id: lead.id },
      data: { leadStatusId: inProgress.id },
    });
  }

  /**
   * Count REJECTED or BLACKLISTED leads (active or not) for this customer
   * whose updatedAt falls within the given lookback window.
   */
  countRecentRejections(customerId: bigint, sinceDate: Date, tx?: DbClient) {
    return this.db(tx).lead.count({
      where: {
        customerId,
        leadStatus: { name: { in: [LEAD_STATUS.REJECTED, LEAD_STATUS.BLACKLISTED] } },
        updatedAt: { gte: sinceDate },
      },
    });
  }

  async shouldBlackListCustomer(
    customerId: bigint,
    blacklistRejectionThreshold: number,
    tx?: DbClient,
  ): Promise<boolean> {
    const recentLeads = await this.db(tx).lead.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: blacklistRejectionThreshold,
      include: { leadStatus: { select: { name: true } } },
    });

    if (recentLeads.length < blacklistRejectionThreshold) return false;

    return recentLeads.every(l => l.leadStatus.name === LEAD_STATUS.REJECTED);
  }

  deactivate(leadId: bigint, tx?: DbClient) {
    return this.db(tx).lead.update({
      where: { id: leadId },
      data: { isActive: false },
    });
  }

  findActiveSummaryForCustomer(customerId: bigint, tx?: DbClient) {
    return this.db(tx).lead.findFirst({
      where: { customerId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, uuid: true, panNumber: true },
    });
  }

  findByUuidForCustomer(uuid: string, customerId: bigint, tx?: DbClient) {
    return this.db(tx).lead.findFirst({
      where: { uuid, customerId, isActive: true },
      select: { id: true, uuid: true, panNumber: true },
    });
  }

}
