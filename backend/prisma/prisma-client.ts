import 'dotenv/config';
import {PrismaMariaDb} from '@prisma/adapter-mariadb';
import {PrismaClient} from '@prisma/client';

/** Use the adapter's expected config type so we do not mix two copies of `mariadb` typings (root vs nested). */
type PrismaMariaDbConfig = ConstructorParameters<typeof PrismaMariaDb>[0];

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return databaseUrl;
}

function createPoolConfig(databaseUrl: string): PrismaMariaDbConfig {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch (cause) {
    throw new Error(
      'Invalid DATABASE_URL: expected mysql://user:pass@host:port/db. See backend/.env.example.',
      { cause: cause as Error }
    );
  }

  if (!url.hostname) {
    throw new Error('Invalid DATABASE_URL: hostname is missing.');
  }
  const database = url.pathname.replace(/^\/+/, '');
  if (!database) {
    throw new Error('Invalid DATABASE_URL: database name is missing from the URL path.');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    // MySQL 8 caching_sha2_password over non-TLS needs the server RSA key;
    // without this, every connect fails and the pool times out at idle=0.
    allowPublicKeyRetrieval: process.env.DB_ALLOW_PUBLIC_KEY_RETRIEVAL !== 'false',
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10_000),
    acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT_MS ?? 60_000),
    initializationTimeout: Number(process.env.DB_INITIALIZATION_TIMEOUT_MS ?? 60_000),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
    timezone: 'Z',
  };
}

export function createPrismaAdapter() {
  return new PrismaMariaDb(createPoolConfig(getDatabaseUrl()));
}

export function createPrismaClient() {
  return new PrismaClient({adapter: createPrismaAdapter()});
}
