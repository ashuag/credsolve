import type { Prisma } from '@prisma/client';
import { LEAD_STATUS } from '../../src/common/constants/lead.constants';

const LEGACY_LEAD_STATUS_NAMES = ['EMAIL_VERIFIED', 'DETAIL_STARTED'] as const;

export async function seedLeadStatus(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(LEAD_STATUS)) {
    await prisma.leadStatus.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  await prisma.leadStatus.updateMany({
    where: { name: { in: [...LEGACY_LEAD_STATUS_NAMES] } },
    data: { isActive: false },
  });

  console.log('Lead status seeded');
}
