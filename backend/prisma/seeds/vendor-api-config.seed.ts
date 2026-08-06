import type { createPrismaClient } from '../prisma-client';

const SEED_ROWS = [
  {
    apiCode: 'cibil_fetch',
    apiName: 'CIBIL fetch',
    vendorName: 'Tenacio',
    priority: 1,
    status: 'ACTIVE',
    notes: 'Primary bureau soft-pull (Experian/CIBIL via Tenacio).',
  },
  {
    apiCode: 'cibil_fetch',
    apiName: 'CIBIL fetch',
    vendorName: 'Surepass',
    priority: 2,
    status: 'ACTIVE',
    notes: 'Primary bureau soft-pull (Experian/CIBIL via surepass)',
  },
  {
    apiCode: 'kyc',
    apiName: 'kyc_digilocker',
    vendorName: 'Surepass',
    priority: 1,
    status: 'ACTIVE',
    notes: 'Fetch aadhaar and pan from digilocker.',
  },
  {
    apiCode: 'kyc',
    apiName: 'kyc_digilocker',
    vendorName: 'Tenacio',
    priority: 2,
    status: 'ACTIVE',
    notes: 'Fetch aadhaar from digilocker.',
  },
] as const;

export async function seedVendorApiConfig(prisma: ReturnType<typeof createPrismaClient>) {
  // Prefer lowercase `kyc` api_code (matches VendorApiConfigService.create). Soft-delete legacy `Kyc` rows.
  await prisma.vendorApiConfig.updateMany({
    where: { apiCode: 'Kyc', apiName: 'kyc_digilocker', isActive: true },
    data: { isActive: false, status: 'INACTIVE' },
  });

  for (const row of SEED_ROWS) {
    await prisma.vendorApiConfig.upsert({
      where: {
        apiCode_vendorName: {
          apiCode: row.apiCode,
          vendorName: row.vendorName,
        },
      },
      create: {
        apiCode: row.apiCode,
        apiName: row.apiName,
        vendorName: row.vendorName,
        priority: row.priority,
        status: row.status,
        notes: row.notes,
        isActive: true,
      },
      update: {
        apiName: row.apiName,
        priority: row.priority,
        notes: row.notes,
        status: row.status,
        isActive: true,
      },
    });
  }

  console.log('Vendor API configs seeded');
}
