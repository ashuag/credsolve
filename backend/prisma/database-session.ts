import { Prisma } from '@prisma/client';

export type DatabaseSession = Readonly<{
  tx: Prisma.TransactionClient;
}>;
