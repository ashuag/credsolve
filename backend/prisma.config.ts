import 'dotenv/config';
import {defineConfig} from 'prisma/config';

const migrateUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrateUrl) {
  throw new Error('Set DATABASE_URL or DIRECT_DATABASE_URL before running Prisma commands.');
}

export default defineConfig({
  // Multi-file schema: `schema` MUST point at the directory (not a file)
  // for Prisma 7 to merge sibling `.prisma` files. Pointing at
  // `prisma/schema.prisma` silently drops models in other files
  // (see prisma/prisma#28673). Models live in `prisma/models/*.prisma`.
  schema: 'prisma',
  migrations: {
    // Required in Prisma ORM 7: without `path`, `migrate deploy` may not apply SQL migrations.
    path: 'prisma/migrations',
    seed: 'npm run seed',
  },
  datasource: {
    url: migrateUrl
  }
});
