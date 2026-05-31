import type { Prisma } from '@prisma/client';
import { OCCUPATION } from '../../src/common/constants/occupation.constants';

export async function seedOccupation(prisma: Prisma.TransactionClient) {
  for (const { key, name } of Object.values(OCCUPATION)) {
    await prisma.occupation.upsert({
      where: { name },
      create: { key, name, isActive: true },
      update: { key, isActive: true },
    });
  }

  console.log('Occupation seeded');
}
