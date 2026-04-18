import { Injectable } from '@nestjs/common';
import { EmailVerificationType } from '@prisma/client';
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
}
