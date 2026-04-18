import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from './db.client';

@Injectable()
export class OtpTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: DbClient) {
    return tx ?? this.prisma.client;
  }

  findActiveByName(tx: DbClient | undefined, name: string) {
    return this.db(tx).otpType.findFirst({
      where: { name, isActive: true },
    });
  }
}
