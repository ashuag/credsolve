import type { Prisma } from '@prisma/client';
import { REJECTION_REASON } from '../../src/common/constants/rejection-reason.constants';

const LEGACY_REJECTION_REASON_NAMES = ['Expired'] as const;

export async function seedRejectionReason(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(REJECTION_REASON)) {
    await prisma.rejectionReason.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  await prisma.rejectionReason.updateMany({
    where: { name: { in: [...LEGACY_REJECTION_REASON_NAMES] } },
    data: { isActive: false },
  });

  console.log('Rejection reasons seeded');
}
