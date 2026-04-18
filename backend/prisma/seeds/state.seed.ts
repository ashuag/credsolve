import type { Prisma } from '@prisma/client';
import { INDIAN_STATES } from '../../src/common/constants/state.constant';

export async function seedState(prisma: Prisma.TransactionClient) {
  for (const { name, code } of INDIAN_STATES) {
    await prisma.state.upsert({
      where: { code },
      create: { name, code, isActive: true },
      update: { name, isActive: true },
    });
  }

  console.log('State seeded');
}
