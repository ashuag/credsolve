import type { Prisma } from '@prisma/client';
import { APPLICATION_STATUS } from '../../src/common/constants/application.constants';

const LEGACY_APPLICATION_STATUS_NAMES = ['SUBMITTED', 'KYC_VERIFIED'] as const;

export async function seedApplicationStatus(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(APPLICATION_STATUS)) {
    await prisma.applicationStatus.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  await prisma.applicationStatus.updateMany({
    where: { name: { in: [...LEGACY_APPLICATION_STATUS_NAMES] } },
    data: { isActive: false },
  });

  console.log('Application status seeded');
}
