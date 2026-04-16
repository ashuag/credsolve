import type { Prisma } from '@prisma/client';
import {APPLICATION_STATUS} from '../../src/common/constants/application.constants';

export async function seedApplicationStatus(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(APPLICATION_STATUS)) {
    await prisma.$executeRaw`
      INSERT INTO \`application_status\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
  }

  console.log('Application status seeded');
}
