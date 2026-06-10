#!/usr/bin/env node
/**
 * Dump `city` rows (with explicit `id`) into backend/prisma/raw_sql/city.sql.
 *
 * Usage (from backend/):
 *   node scripts/dump-city-to-raw-sql.mjs
 */
import { createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const BATCH_SIZE = 500;
const COLUMNS = ['id', 'name', 'state_id', 'is_active', 'created_at', 'source_city_id'];
const OUT_PATH = join(__dirname, '..', 'prisma', 'raw_sql', 'city.sql');

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) {
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    const ms = pad(value.getMilliseconds(), 3);
    return `'${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${ms}'`;
  }
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function formatRow(row) {
  return `(${COLUMNS.map((col) => sqlValue(row[col])).join(',')})`;
}

async function main() {
  const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required');
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        name,
        state_id,
        is_active,
        created_at,
        source_city_id
      FROM city
      ORDER BY id
    `);

    const out = createWriteStream(OUT_PATH, { encoding: 'utf8' });
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = batch.map(formatRow).join(',');
      out.write(
        `INSERT IGNORE INTO \`city\` (\`${COLUMNS.join('`, `')}\`) VALUES ${values};\n`,
      );
    }
    await new Promise((resolve, reject) => {
      out.end((err) => (err ? reject(err) : resolve()));
    });

    console.log(`Wrote ${rows.length} city rows to ${OUT_PATH}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
