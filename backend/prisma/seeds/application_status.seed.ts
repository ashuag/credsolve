import type { Prisma } from '@prisma/client';
import { APPLICATION_STATUS } from '../../src/common/constants/application.constants';

const LEGACY_APPLICATION_STATUS_NAMES = ['SUBMITTED', 'KYC_VERIFIED'] as const;

const APPLICATION_STATUS_DISPLAY_NAMES: Partial<Record<string, string>> = {
  [APPLICATION_STATUS.DISBURSAL_INPROCESS]: 'Disbursal in process',
  [APPLICATION_STATUS.DISBURSAL_FAILED]: 'Disbursal failed',
};

export async function seedApplicationStatus(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(APPLICATION_STATUS)) {
    const displayName = APPLICATION_STATUS_DISPLAY_NAMES[name];
    await prisma.applicationStatus.upsert({
      where: { name },
      create: { name, isActive: true, displayName },
      update: displayName ? { isActive: true, displayName } : { isActive: true },
    });
  }

  await prisma.applicationStatus.updateMany({
    where: { name: { in: [...LEGACY_APPLICATION_STATUS_NAMES] } },
    data: { isActive: false },
  });

  console.log('Application status seeded');
}
