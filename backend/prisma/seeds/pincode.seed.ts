import type { Prisma } from '@prisma/client';
import { AIZAWL_CITY_ID, AIZAWL_PINCODES } from '../../src/common/constants/aizawl-pincode.constants';
import { HISAR_CITY_ID, HISAR_PINCODES } from '../../src/common/constants/hisar-pincode.constants';
import { THANE_CITY_ID, THANE_PINCODES } from '../../src/common/constants/thane-pincode.constants';
import {
  VASAI_VIRAR_CITY_ID,
  VASAI_VIRAR_PINCODES,
} from '../../src/common/constants/vasai-virar-pincode.constants';
import {
  VISAKHAPATNAM_CITY_ID,
  VISAKHAPATNAM_PINCODES,
} from '../../src/common/constants/visakhapatnam-pincode.constants';

async function seedPincodesForCity(
  prisma: Prisma.TransactionClient,
  cityId: number,
  codes: readonly string[],
  label: string,
) {
  for (const code of codes) {
    await prisma.pincode.upsert({
      where: { code },
      create: { code, cityId, isActive: true },
      update: { cityId, isActive: true },
    });
  }

  console.log(`Pincode seeded (${codes.length} for ${label})`);
}

export async function seedPincode(prisma: Prisma.TransactionClient) {
  await seedPincodesForCity(prisma, VISAKHAPATNAM_CITY_ID, VISAKHAPATNAM_PINCODES, 'Visakhapatnam');
  await seedPincodesForCity(prisma, HISAR_CITY_ID, HISAR_PINCODES, 'Hisar');
  await seedPincodesForCity(prisma, VASAI_VIRAR_CITY_ID, VASAI_VIRAR_PINCODES, 'Vasai-Virar');
  await seedPincodesForCity(prisma, THANE_CITY_ID, THANE_PINCODES, 'Thane');
  await seedPincodesForCity(prisma, AIZAWL_CITY_ID, AIZAWL_PINCODES, 'Aizawl');
}
