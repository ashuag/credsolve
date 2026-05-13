import type { Prisma } from '@prisma/client';
import { REJECTION_REASON } from '../../src/common/constants/rejection-reason.constants';

export async function seedRejectionReason(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(REJECTION_REASON)) {
    await prisma.rejectionReason.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  console.log('Rejection reasons seeded');
}
