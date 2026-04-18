import type { PrismaClient } from '@prisma/client';

/**
 * Fail fast with an actionable message when `prisma migrate deploy` was never run
 * against this database (common when DATABASE_URL points at the wrong DB or a fresh volume).
 */
export async function ensureApplicationTablesExist(client: PrismaClient): Promise<void> {
  const rows = await client.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) AS c
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'otp_type'
  `;
  const count = Number(rows[0]?.c ?? 0);
  if (count === 0) {
    throw new Error(
      '[schema] Table `otp_type` is missing — Prisma migrations have not been applied to this database.\n\n' +
        'Fix:\n' +
        '  • Docker: docker compose exec backend sh -c "cd /workspace/backend && npm run prisma:migrate:deploy"\n' +
        '  • Local:  cd backend && npm run prisma:migrate:deploy\n\n' +
        'Then run seeds if needed: npm run seed\n' +
        'Check DATABASE_URL uses the intended database name and host (inside Compose use host `db`, not localhost).'
    );
  }
}
