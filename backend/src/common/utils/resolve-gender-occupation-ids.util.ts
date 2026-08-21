import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolve customer-journey gender/occupation keys to master ids.
 * Lookup is by `key` (stable) rather than display `name`, so LOS master
 * renames do not break onboarding.
 */
export async function resolveGenderOccupationIds(
  prisma: PrismaService['client'],
  genderKey: string,
  occupationKey: string,
): Promise<{ genderId: number; occupationId: number; genderName: string; occupationName: string }> {
  const [gender, occupation] = await Promise.all([
    prisma.gender.findFirst({
      where: { key: genderKey, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.occupation.findFirst({
      where: { key: occupationKey, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!gender || !occupation) {
    throw new BadRequestException('Gender or occupation is not available in the system.');
  }

  return {
    genderId: gender.id,
    occupationId: occupation.id,
    genderName: gender.name,
    occupationName: occupation.name,
  };
}

export async function resolveOccupationId(
  prisma: PrismaService['client'],
  occupationKey: string,
): Promise<{ occupationId: number; occupationName: string }> {
  const occupation = await prisma.occupation.findFirst({
    where: { key: occupationKey, isActive: true },
    select: { id: true, name: true },
  });
  if (!occupation) {
    throw new BadRequestException('Occupation is not available in the system.');
  }
  return { occupationId: occupation.id, occupationName: occupation.name };
}
