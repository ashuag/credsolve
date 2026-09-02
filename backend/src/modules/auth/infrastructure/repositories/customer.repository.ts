import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from './db.client';

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: DbClient) {
    return tx ?? this.prisma.client;
  }

  upsertByMobile(tx: DbClient | undefined, mobile: string) {
    return this.db(tx).customer.upsert({
      where: { mobileNumber: mobile },
      create: { mobileNumber: mobile },
      update: {},
      select: { id: true, uuid: true, mobileNumber: true, isBlacklisted: true },
    });
  }

  findByUuid(tx: DbClient | undefined, uuid: string) {
    return this.db(tx).customer.findUnique({
      where: { uuid },
      select: { id: true, uuid: true, mobileNumber: true, panNsdlCacheId: true },
    });
  }
}
