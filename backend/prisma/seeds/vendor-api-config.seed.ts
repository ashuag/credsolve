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
    notes: 'Fallback bureau soft-pull, used automatically when Tenacio errors (Surepass credit-report-cibil; response wrapped to Tenacio keys). Needs SUREPASS_TOKEN.',
  },
] as const;

export async function seedVendorApiConfig(prisma: ReturnType<typeof createPrismaClient>) {
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
        isActive: true,
      },
    });
  }

  console.log('Vendor API configs seeded');
}
