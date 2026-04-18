import type { Prisma, PrismaClient } from '@prisma/client';

/** Prisma client or interactive transaction client. */
export type DbClient = PrismaClient | Prisma.TransactionClient;
