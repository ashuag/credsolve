import 'dotenv/config';
import {PrismaMariaDb} from '@prisma/adapter-mariadb';
import {PrismaClient} from '@prisma/client';
import type {PoolConfig} from 'mariadb';

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return databaseUrl;
}

function createPoolConfig(databaseUrl: string): PoolConfig | string {
  try {
    const url = new URL(databaseUrl);

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\/+/, ''),
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10_000),
      acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT_MS ?? 60_000),
      initializationTimeout: Number(process.env.DB_INITIALIZATION_TIMEOUT_MS ?? 60_000),
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
      timezone: 'Z'
    };
  } catch {
    return databaseUrl;
  }
}

export function createPrismaAdapter() {
  return new PrismaMariaDb(createPoolConfig(getDatabaseUrl()));
}

export function createPrismaClient() {
  return new PrismaClient({adapter: createPrismaAdapter()});
}
