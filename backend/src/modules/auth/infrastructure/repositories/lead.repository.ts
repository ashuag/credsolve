import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { generateLeadNumber } from '../../../../common/loan/application-number.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from './db.client';

const LEAD_NUMBER_CREATE_ATTEMPTS = 8;

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

  /** Prisma `lead_detail.update` — caller supplies full args. */
  updateLeadDetail(args: any, tx?: DbClient) {
    return this.db(tx).leadDetail.update(args);
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
            gender: { select: { key: true, name: true } },
            occupation: { select: { key: true, name: true } },
            city: { select: { name: true, state: { select: { code: true } } } },
          },
        },
      },
    });
  }

  async createForCustomer(
    params: { customerId: bigint; leadStatusId: number },
    tx?: DbClient
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < LEAD_NUMBER_CREATE_ATTEMPTS; attempt += 1) {
      try {
        return await this.db(tx).lead.create({
          data: {
            customerId: params.customerId,
            leadStatusId: params.leadStatusId,
            leadNumber: generateLeadNumber(),
          },
          include: {
            leadStatus: { select: { name: true } },
            leadDetail: {
              include: {
                gender: { select: { key: true, name: true } },
                occupation: { select: { key: true, name: true } },
                city: { select: { name: true, state: { select: { code: true } } } },
              },
            },
          },
        });
      } catch (err) {
        lastError = err;
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const target = err.meta?.target;
          const targets = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
          if (targets.some((t) => /lead_id|leadNumber/i.test(t))) {
            continue;
          }
        }
        throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new InternalServerErrorException('Failed to allocate a unique lead id.');
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

  reactivate(leadId: bigint, tx?: DbClient) {
    return this.db(tx).lead.update({
      where: { id: leadId },
      data: { isActive: true },
    });
  }

  findActiveSummaryForCustomer(customerId: bigint, tx?: DbClient) {
    return this.db(tx).lead.findFirst({
      where: { customerId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        leadDetail: { select: { panNumber: true, fullName: true } },
      },
    });
  }

  findByUuidForCustomer(uuid: string, customerId: bigint, tx?: DbClient) {
    return this.db(tx).lead.findFirst({
      where: { uuid, customerId, isActive: true },
      select: {
        id: true,
        uuid: true,
        leadDetail: { select: { panNumber: true, fullName: true } },
      },
    });
  }

}
