import type { Prisma } from '@prisma/client';
import { GENDER } from '../../src/common/constants/gender.constants';

export async function seedGender(prisma: Prisma.TransactionClient) {
  for (const { key, name } of Object.values(GENDER)) {
    await prisma.gender.upsert({
      where: { name },
      create: { key, name, isActive: true },
      update: { key, isActive: true },
    });
  }

  console.log('Gender seeded');
}
