import type { Prisma } from '@prisma/client';
import { INDIAN_CITIES } from '../../src/common/constants/city.constants';

export async function seedCity(prisma: Prisma.TransactionClient) {
  for (const { id, name, stateId } of INDIAN_CITIES) {
    const normalizedName = name.toUpperCase();
    await prisma.city.upsert({
      where: { name_stateId: { name: normalizedName, stateId } },
      create: { id, name: normalizedName, stateId, isActive: true },
      update: { name: normalizedName, stateId, isActive: true },
    });
  }

  console.log('City seeded');
}
