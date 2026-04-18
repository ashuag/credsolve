import type { Prisma } from '@prisma/client';
import { OCCUPATION } from '../../src/common/constants/occupation.constants';

export async function seedOccupation(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(OCCUPATION)) {
    await prisma.occupation.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  console.log('Occupation seeded');
}
