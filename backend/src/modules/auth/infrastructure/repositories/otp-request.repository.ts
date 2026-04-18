import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from './db.client';

@Injectable()
export class OtpRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: DbClient) {
    return tx ?? this.prisma.client;
  }

  findLatestPendingByValueAndType(tx: DbClient | undefined, value: string, typeId: number) {
    return this.db(tx).otpRequest.findFirst({
      where: { value, typeId, verifiedAt: null },
      orderBy: { lastSentAt: 'desc' },
    });
  }

  findPendingByUuidAndType(tx: DbClient | undefined, uuid: string, typeId: number) {
    return this.db(tx).otpRequest.findFirst({
      where: { uuid, typeId, verifiedAt: null },
    });
  }

  create(tx: DbClient | undefined, data: Prisma.OtpRequestCreateInput) {
    return this.db(tx).otpRequest.create({ data });
  }

  incrementAttempts(tx: DbClient | undefined, id: number) {
    return this.db(tx).otpRequest.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  }

  markVerified(tx: DbClient | undefined, id: number, verifiedAt: Date) {
    return this.db(tx).otpRequest.update({
      where: { id },
      data: { verifiedAt },
    });
  }
}
