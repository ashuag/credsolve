import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from './prisma-client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private connected = false;

  constructor() {
    super({ adapter: createPrismaAdapter() });
  }

  async onModuleInit() {
    await this.$connect();
    this.connected = true;
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.connected = false;
  }

  getStatus() {
    return {
      connected: this.connected
    };
  }
}
