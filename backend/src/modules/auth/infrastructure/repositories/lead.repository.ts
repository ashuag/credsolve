import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EmailVerificationType } from '@prisma/client';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from './db.client';

@Injectable()
export class LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: DbClient) {
    return tx ?? this.prisma.client;
  }

  findActiveByCustomerId(tx: DbClient | undefined, customerId: bigint) {
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
    tx: DbClient | undefined,
    params: { customerId: bigint; leadStatusId: number; expiresAt: Date }
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

  updateEmailFromOtp(tx: DbClient | undefined, leadId: bigint, email: string) {
    return this.db(tx).lead.update({
      where: { id: leadId },
      data: {
        email,
        emailVerificationType: EmailVerificationType.OTP,
      },
    });
  }

  /**
   * After verified email is persisted (OTP or Google), set lead to IN_PROGRESS.
   * No-op when the lead is already CONVERTED.
   */
  async applyInProgressAfterEmailVerified(
    tx: DbClient | undefined,
    lead: { id: bigint; leadStatus: { name: string } }
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

  findActiveSummaryForCustomer(tx: DbClient | undefined, customerId: bigint) {
    return this.db(tx).lead.findFirst({
      where: { customerId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, uuid: true },
    });
  }

  findByUuidForCustomer(tx: DbClient | undefined, uuid: string, customerId: bigint) {
    return this.db(tx).lead.findFirst({
      where: { uuid, customerId, isActive: true },
      select: { id: true, uuid: true },
    });
  }

  updateLeadEmailWithVerification(
    tx: DbClient | undefined,
    leadId: bigint,
    email: string,
    verificationType: EmailVerificationType
  ) {
    return this.db(tx).lead.update({
      where: { id: leadId },
      data: {
        email,
        emailVerificationType: verificationType,
      },
    });
  }
}
