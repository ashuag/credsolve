import 'dotenv/config';
import {PrismaMariaDb} from '@prisma/adapter-mariadb';
import {PrismaClient} from '@prisma/client';

/** Use the adapter's expected config type so we do not mix two copies of `mariadb` typings (root vs nested). */
type PrismaMariaDbConfig = ConstructorParameters<typeof PrismaMariaDb>[0];

const DEFAULT_REPLICA_USER = 'moneycash_repl';
const DEFAULT_REPLICA_DATABASE = 'moneycash';

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return databaseUrl;
}

/**
 * Replica URL for LOS reads.
 * Prefer `DATABASE_REPLICA_URL`. Otherwise compose from
 * `DATABASE_REPLICA_HOST` + user `moneycash_repl` + db `moneycash`.
 */
export function resolveReplicaDatabaseUrl(): string | null {
  const explicit = process.env.DATABASE_REPLICA_URL?.trim();
  if (explicit) return explicit;

  const host = process.env.DATABASE_REPLICA_HOST?.trim();
  if (!host) return null;

  const user = process.env.DATABASE_REPLICA_USER?.trim() || DEFAULT_REPLICA_USER;
  const password = process.env.DATABASE_REPLICA_PASSWORD ?? '';
  const database = process.env.DATABASE_REPLICA_DATABASE?.trim() || DEFAULT_REPLICA_DATABASE;
  const port = process.env.DATABASE_REPLICA_PORT?.trim() || '3306';
  const query = process.env.DATABASE_REPLICA_PARAMS?.trim();
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const base = `mysql://${auth}@${host}:${port}/${database}`;
  return query ? `${base}?${query.replace(/^\?/, '')}` : base;
}

export function describeDatabaseTarget(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    const database = url.pathname.replace(/^\/+/, '');
    const port = url.port || '3306';
    return `${decodeURIComponent(url.username)}@${url.hostname}:${port}/${database}`;
  } catch {
    return '(invalid replica URL)';
  }
}

function createPoolConfig(databaseUrl: string, options?: {readOnly?: boolean}): PrismaMariaDbConfig {
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

  const connectionLimit = Number(
    options?.readOnly
      ? (process.env.DB_REPLICA_CONNECTION_LIMIT ?? process.env.DB_CONNECTION_LIMIT ?? 10)
      : (process.env.DB_CONNECTION_LIMIT ?? 10),
  );

  const config: PrismaMariaDbConfig = {
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
    connectionLimit,
    timezone: 'Z',
  };

  if (options?.readOnly) {
    (config as PrismaMariaDbConfig & {initSql?: string}).initSql = 'SET SESSION TRANSACTION READ ONLY';
  }

  return config;
}

export function createPrismaAdapter(databaseUrl = getDatabaseUrl(), options?: {readOnly?: boolean}) {
  return new PrismaMariaDb(createPoolConfig(databaseUrl, options));
}

export function createPrismaClient(databaseUrl = getDatabaseUrl(), options?: {readOnly?: boolean}) {
  return new PrismaClient({adapter: createPrismaAdapter(databaseUrl, options)});
}

export function createReplicaPrismaClient(): PrismaClient | null {
  const replicaUrl = resolveReplicaDatabaseUrl();
  if (!replicaUrl) return null;
  return createPrismaClient(replicaUrl, {readOnly: true});
}
