import type { Prisma } from '@prisma/client';
import { INDIAN_CITIES } from '../../src/common/constants/city.constants';

export async function seedCity(prisma: Prisma.TransactionClient) {
  for (const { id, name, stateId } of INDIAN_CITIES) {
    await prisma.city.upsert({
      where: { name_stateId: { name, stateId } },
      create: { id, name, stateId, isActive: true },
      update: { name, stateId, isActive: true },
    });
  }

  console.log('City seeded');
}
