import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createPrismaClient } from '../../prisma/prisma-client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = createPrismaClient();

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
