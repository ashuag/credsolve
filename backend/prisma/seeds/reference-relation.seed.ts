import type { Prisma } from '@prisma/client';
import { REFERENCE_RELATION } from '../../src/common/constants/reference-relation.constants';

export async function seedReferenceRelation(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(REFERENCE_RELATION)) {
    await prisma.referenceRelation.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  console.log('Reference relations seeded');
}
