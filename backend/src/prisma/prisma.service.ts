import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  createPrismaClient,
  createReplicaPrismaClient,
  describeDatabaseTarget,
  isReplicaConnectionError,
  resolveReplicaDatabaseUrl,
} from '../../prisma/prisma-client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: PrismaClient = createPrismaClient();
  private replicaClient: PrismaClient | null = createReplicaPrismaClient();
  private replicaReads: PrismaClient | null = null;

  /**
   * MySQL replica for LOS list/detail reads. Falls back to primary when the replica
   * is not configured, unreachable, or later hits a pool/socket timeout.
   * Writes and customer-journey queries must keep using {@link client}.
   *
   * Reads stay on primary until a background ping succeeds so a dead replica cannot
   * delay Nest listen / health checks (Firefox then reports that as CORS).
   */
  get read(): PrismaClient {
    return this.replicaReads ?? this.client;
  }

  async onModuleInit(): Promise<void> {
    if (!this.replicaClient) {
      this.logger.log('LOS reads use primary (DATABASE_REPLICA_URL / DATABASE_REPLICA_HOST not set)');
      return;
    }

    const replicaUrl = resolveReplicaDatabaseUrl();
    const target = replicaUrl ? describeDatabaseTarget(replicaUrl) : '(replica)';
    this.logger.log(`Replica configured at ${target}; LOS reads use primary until ping succeeds`);
    void this.activateReplicaIfHealthy(target);
  }

  private async activateReplicaIfHealthy(target: string): Promise<void> {
    if (!this.replicaClient) return;
    const pingMs = Number(process.env.DB_REPLICA_CONNECT_TIMEOUT_MS ?? 3_000) + 2_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.replicaClient.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('replica startup ping timed out')), pingMs);
        }),
      ]);
      if (!this.replicaClient) return;
      this.replicaReads = this.wrapReplicaReads(this.replicaClient);
      this.logger.log(`LOS reads use replica ${target}`);
    } catch (err) {
      this.disableReplica(err, `startup ping failed for ${target}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    if (this.replicaClient) {
      await this.replicaClient.$disconnect();
    }
  }

  private disableReplica(err: unknown, reason: string): void {
    if (!this.replicaClient && !this.replicaReads) return;
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Replica disabled (${reason}); LOS reads use primary. ${message}`);
    const toClose = this.replicaClient;
    this.replicaClient = null;
    this.replicaReads = null;
    void toClose?.$disconnect().catch(() => undefined);
  }

  private wrapReplicaReads(replica: PrismaClient | null): PrismaClient | null {
    if (!replica) return null;

    const extended = replica.$extends({
      query: {
        $allOperations: async ({ model, operation, args, query }) => {
          try {
            return await query(args);
          } catch (err) {
            if (!isReplicaConnectionError(err)) throw err;
            this.disableReplica(err, 'query connection failure');
            return this.retryOnPrimary(model, operation, args, err);
          }
        },
      },
    });

    return extended as unknown as PrismaClient;
  }

  private retryOnPrimary(
    model: string | undefined,
    operation: string,
    args: unknown,
    originalError: unknown,
  ): Promise<unknown> {
    const fn = this.primaryOperation(model, operation);
    if (!fn) throw originalError;
    this.logger.warn(`Retrying ${model ?? 'client'}.${operation} on primary after replica failure`);
    return fn(args);
  }

  private primaryOperation(
    model: string | undefined,
    operation: string,
  ): ((args: unknown) => Promise<unknown>) | null {
    const primary = this.client as unknown as Record<string, unknown>;
    if (model) {
      const key = model.charAt(0).toLowerCase() + model.slice(1);
      const delegate = primary[key];
      if (delegate && typeof (delegate as Record<string, unknown>)[operation] === 'function') {
        return (opArgs) =>
          (delegate as Record<string, (a: unknown) => Promise<unknown>>)[operation]!(opArgs);
      }
    }
    const clientOp = primary[operation];
    if (typeof clientOp === 'function') {
      return (opArgs) => (clientOp as (a: unknown) => Promise<unknown>).call(this.client, opArgs);
    }
    return null;
  }
}
