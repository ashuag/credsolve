import 'dotenv/config';
import {defineConfig} from 'prisma/config';

const migrateUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrateUrl) {
  throw new Error('Set DATABASE_URL or DIRECT_DATABASE_URL before running Prisma commands.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'npm run seed'
  },
  datasource: {
    url: migrateUrl
  }
});
