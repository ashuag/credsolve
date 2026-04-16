import type { Prisma } from '@prisma/client';
import {OTP_TYPE} from '../../src/common/constants/otp.constants';

export async function seedOtpType(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(OTP_TYPE)) {
    await prisma.$executeRaw`
      INSERT INTO \`otp_type\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
  }

  console.log('OtpType seeded');
}
