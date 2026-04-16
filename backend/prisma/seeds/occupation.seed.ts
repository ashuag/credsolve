import type { Prisma } from '@prisma/client';
import { OCCUPATION } from '../../src/common/constants/occupation.constants';

export async function seedOccupation(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(OCCUPATION)) {
    await prisma.$executeRaw`
      INSERT INTO \`occupation\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
  }

  console.log('Occupation seeded');
}
