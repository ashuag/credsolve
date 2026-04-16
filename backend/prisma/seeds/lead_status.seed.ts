import type { Prisma } from '@prisma/client';
import {LEAD_STATUS} from '../../src/common/constants/lead.constants';

export async function seedLeadStatus(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(LEAD_STATUS)) {
    await prisma.$executeRaw`
      INSERT INTO \`lead_status\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
  }

  console.log('Lead status seeded');
}
