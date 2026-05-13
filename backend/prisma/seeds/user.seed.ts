import * as bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';

type SeedUser = {
  fullName: string;
  email: string;
  password: string;
  roleId: number;
};

export async function seedUser(prisma: Prisma.TransactionClient) {
  const password = process.env.DEFAULT_STAFF_PASSWORD || 'Secret123!';
  const hashedPassword = bcrypt.hashSync(password, 10);

  const users: SeedUser[] = [
    {
      fullName: 'MoneyCash Admin',
      email: 'admin@moneycash.in',
      password: hashedPassword,
      roleId: 1,
    },
  ];

  const now = new Date();

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        fullName: user.fullName,
        email: user.email,
        password: user.password,
        roleId: user.roleId,
        isActive: true,
        registrationCompletedAt: now,
      },
      update: {
        fullName: user.fullName,
        password: user.password,
        roleId: user.roleId,
        isActive: true,
        registrationCompletedAt: now,
      },
    });
  }

  console.log('Users seeded');
}
