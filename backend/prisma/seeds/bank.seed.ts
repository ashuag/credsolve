import type { Prisma } from '@prisma/client';

const BANKS = [
  'State Bank of India',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Indian Bank',
  'Indian Overseas Bank',
  'UCO Bank',
  'Central Bank of India',
  'Bank of Maharashtra',
  'Punjab & Sind Bank',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'IDFC FIRST Bank',
  'RBL Bank',
  'Yes Bank',
  'Bandhan Bank',
  'CSB Bank',
  'Dhanlaxmi Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karur Vysya Bank',
  'Tamilnad Mercantile Bank',
  'City Union Bank',
  'Jammu & Kashmir Bank',
  'Karnataka Bank',
  'Nainital Bank',
  'HSBC India',
  'Citibank India',
  'Standard Chartered Bank',
  'Deutsche Bank India',
  'Barclays Bank India',
  'BNP Paribas India',
  'DBS Bank India',
  'Bank of America India',
  'JPMorgan Chase India',
  'Credit Suisse India',
  'AU Small Finance Bank',
  'Ujjivan Small Finance Bank',
  'Equitas Small Finance Bank',
  'Jana Small Finance Bank',
  'Suryoday Small Finance Bank',
  'Utkarsh Small Finance Bank',
  'ESAF Small Finance Bank',
  'Fincare Small Finance Bank',
  'North East Small Finance Bank',
  'Capital Small Finance Bank',
  'Paytm Payments Bank',
  'Airtel Payments Bank',
  'India Post Payments Bank',
  'Jio Payments Bank',
  'Fino Payments Bank',
] as const;

/** Ensures `bank` exists for DBs created before the Prisma migration that added it. */
async function ensureBankTable(prisma: Prisma.TransactionClient) {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS \`bank\` (
    \`id\` SMALLINT NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(100) NOT NULL,
    \`is_active\` BOOLEAN NOT NULL DEFAULT true,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`bank_name_key\`(\`name\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`);
}

export async function seedBank(prisma: Prisma.TransactionClient) {
  await ensureBankTable(prisma);

  for (const name of BANKS) {
    await prisma.$executeRaw`
      INSERT INTO bank (name, is_active, created_at, updated_at)
      VALUES (${name}, true, NOW(), NOW())
      ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), updated_at = NOW()
    `;
  }

  console.log(`Bank seeded (${BANKS.length} records)`);
}
