import type { Prisma } from '@prisma/client';

const USER_ROLES = [
  { id: 1, name: 'ADMIN', hierarchyLevel: 1 },
  { id: 2, name: 'Team Lead', hierarchyLevel: 2 },
  { id: 3, name: 'Agent', hierarchyLevel: 3 },
] as const;

export async function seedUserRole(prisma: Prisma.TransactionClient) {
  for (const role of USER_ROLES) {
    await prisma.userRole.upsert({
      where: { id: role.id },
      create: {
        id: role.id,
        name: role.name,
        hierarchyLevel: role.hierarchyLevel,
        isActive: true,
      },
      update: {
        name: role.name,
        hierarchyLevel: role.hierarchyLevel,
        isActive: true,
      },
    });
  }

  console.log('UserRole seeded');
}
