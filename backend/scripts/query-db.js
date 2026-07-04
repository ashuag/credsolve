const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const kycRecords = await prisma.customerKyc.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        customerId: true,
        panCardNumber: true,
        aadhaarPhotoPath: true,
        createdAt: true,
      }
    });
    console.log("Customer KYC Records:");
    console.log(JSON.stringify(kycRecords, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2));

    const vendorLogs = await prisma.$queryRaw`
      SELECT id, provider_name, service_name, http_status, created_at
      FROM vendor_api_log
      ORDER BY created_at DESC
      LIMIT 10;
    `;
    console.log("\nRecent Vendor API Logs:");
    console.log(JSON.stringify(vendorLogs, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2));

  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
