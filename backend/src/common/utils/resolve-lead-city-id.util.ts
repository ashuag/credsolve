import type { PrismaService } from '../../prisma/prisma.service';

export async function resolveLeadCityId(
  prisma: PrismaService['client'],
  input: { currentCityId?: number | null; currentCity: string },
): Promise<number | null> {
  if (input.currentCityId != null) {
    const byId = await prisma.city.findFirst({
      where: { id: input.currentCityId, isActive: true },
      select: { id: true },
    });
    return byId?.id ?? null;
  }

  const normalized = input.currentCity.replace(/\s+/g, ' ').trim();
  const parts = normalized
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const cityName = parts[0]!;
    const stateSegment = parts[parts.length - 1]!.trim();
    const stateCode = stateSegment.length <= 3 ? stateSegment.toUpperCase() : null;

    if (stateCode) {
      const row = await prisma.city.findFirst({
        where: {
          name: cityName,
          isActive: true,
          state: { code: stateCode },
        },
        select: { id: true },
      });
      if (row) {
        return row.id;
      }
    }

    const state = await prisma.state.findFirst({
      where: {
        isActive: true,
        OR: [...(stateCode ? [{ code: stateCode }] : []), { name: stateSegment }],
      },
      select: { id: true },
    });
    if (state) {
      const row = await prisma.city.findFirst({
        where: { name: cityName, isActive: true, stateId: state.id },
        select: { id: true },
      });
      if (row) {
        return row.id;
      }
    }
  }

  const single = await prisma.city.findFirst({
    where: { name: normalized, isActive: true },
    select: { id: true },
  });
  return single?.id ?? null;
}
