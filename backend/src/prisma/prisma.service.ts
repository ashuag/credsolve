import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  createPrismaClient,
  createReplicaPrismaClient,
  describeDatabaseTarget,
  resolveReplicaDatabaseUrl,
} from '../../prisma/prisma-client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: PrismaClient = createPrismaClient();
  private readonly replicaClient: PrismaClient | null = createReplicaPrismaClient();

  constructor() {
    const replicaUrl = resolveReplicaDatabaseUrl();
    if (this.replicaClient && replicaUrl) {
      this.logger.log(`LOS reads use replica ${describeDatabaseTarget(replicaUrl)}`);
    } else {
      this.logger.log('LOS reads use primary (DATABASE_REPLICA_URL / DATABASE_REPLICA_HOST not set)');
    }
  }

  /**
   * MySQL replica for LOS list/detail reads. Falls back to primary when no replica is configured.
   * Writes and customer-journey queries must keep using {@link client}.
   */
  get read(): PrismaClient {
    return this.replicaClient ?? this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    if (this.replicaClient) {
      await this.replicaClient.$disconnect();
    }
  }
}
