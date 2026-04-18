import type { Prisma } from '@prisma/client';
import { OTP_TYPE } from '../../src/common/constants/otp.constants';

export async function seedOtpType(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(OTP_TYPE)) {
    await prisma.otpType.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  console.log('OtpType seeded');
}
