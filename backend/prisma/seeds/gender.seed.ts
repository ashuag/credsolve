import type { Prisma } from '@prisma/client';
import { GENDER } from '../../src/common/constants/gender.constants';

export async function seedGender(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(GENDER)) {
    await prisma.gender.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  console.log('Gender seeded');
}
