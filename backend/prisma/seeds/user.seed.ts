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
      email: 'admin@moneycash.test',
      password: hashedPassword,
      roleId: 1,
    }
  ];

  for (const user of users) {
    await prisma.$executeRaw`
      INSERT INTO \`user\` (full_name, email, password, role_id, is_active, updated_at)
      VALUES (${user.fullName}, ${user.email}, ${user.password}, ${user.roleId}, 1, NOW(3))
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        password = VALUES(password),
        role_id = VALUES(role_id),
        is_active = VALUES(is_active),
        registration_completed_at = NOW(3),
        updated_at = NOW(3)
    `;
  }

  console.log('Users seeded');
}
