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

function decodeUriComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Parse mysql://user:pass@host:port/db when the password contains `@`, `#`, or `$`.
 * `new URL()` treats `#` as a fragment and the first `@` as the host split.
 */
export function parseMysqlUrl(databaseUrl: string): URL {
  const trimmed = databaseUrl.trim();
  const schemeEnd = trimmed.indexOf('://');
  if (schemeEnd < 0) {
    throw new Error('Invalid DATABASE_URL: expected mysql://user:pass@host:port/db.');
  }
  const scheme = trimmed.slice(0, schemeEnd + 3);
  const rest = trimmed.slice(schemeEnd + 3);
  const at = rest.lastIndexOf('@');
  if (at < 0) {
    return new URL(trimmed);
  }
  const userinfo = rest.slice(0, at);
  const hostPart = rest.slice(at + 1);
  const colon = userinfo.indexOf(':');
  const user = colon < 0 ? userinfo : userinfo.slice(0, colon);
  const password = colon < 0 ? '' : userinfo.slice(colon + 1);
  return new URL(
    `${scheme}${encodeURIComponent(decodeUriComponentSafe(user))}:${encodeURIComponent(decodeUriComponentSafe(password))}@${hostPart}`,
  );
}

function mysqlDatabaseName(databaseUrl: string): string {
  try {
    return parseMysqlUrl(databaseUrl).pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  } catch {
    return '';
  }
}

function replicaDatabaseName(): string {
  return (
    process.env.DATABASE_REPLICA_DATABASE?.trim() ||
    mysqlDatabaseName(process.env.DATABASE_URL ?? '') ||
    DEFAULT_REPLICA_DATABASE
  );
}

/** Insert `/dbname` when the URL is `mysql://user:pass@host:3306` with no path. */
function withMysqlDatabaseName(databaseUrl: string, database: string): string {
  let url: URL;
  try {
    url = parseMysqlUrl(databaseUrl);
  } catch {
    return databaseUrl;
  }
  if (url.pathname.replace(/^\/+/, '').split('/')[0]) return url.toString();
  url.pathname = `/${database}`;
  return url.toString();
}

/**
 * Replica URL for LOS reads.
 * Prefer `DATABASE_REPLICA_URL`. Otherwise compose from
 * `DATABASE_REPLICA_HOST` + user `moneycash_repl` + db `moneycash`.
 */
export function resolveReplicaDatabaseUrl(): string | null {
  const database = replicaDatabaseName();
  const explicit = process.env.DATABASE_REPLICA_URL?.trim();
  if (explicit) return withMysqlDatabaseName(explicit, database);

  const host = process.env.DATABASE_REPLICA_HOST?.trim();
  if (!host) return null;

  const user = process.env.DATABASE_REPLICA_USER?.trim() || DEFAULT_REPLICA_USER;
  const password = process.env.DATABASE_REPLICA_PASSWORD ?? '';
  const port = process.env.DATABASE_REPLICA_PORT?.trim() || '3306';
  const query = process.env.DATABASE_REPLICA_PARAMS?.trim();
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const base = `mysql://${auth}@${host}:${port}/${database}`;
  return query ? `${base}?${query.replace(/^\?/, '')}` : base;
}

export function describeDatabaseTarget(databaseUrl: string): string {
  try {
    const url = parseMysqlUrl(databaseUrl);
    const database = url.pathname.replace(/^\/+/, '');
    const port = url.port || '3306';
    return `${decodeURIComponent(url.username)}@${url.hostname}:${port}/${database}`;
  } catch {
    return '(invalid replica URL)';
  }
}

/** True when a replica query failed because the host/pool is unreachable — not a SQL error. */
export function isReplicaConnectionError(err: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i += 1) {
    if (current instanceof Error) {
      parts.push(current.name, current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  const text = parts.join(' ').toLowerCase();
  return (
    text.includes('pool timeout') ||
    text.includes('connection timeout') ||
    text.includes('failed to create socket') ||
    text.includes('econnrefused') ||
    text.includes('etimedout') ||
    text.includes('enotfound') ||
    text.includes('ehostunreach') ||
    text.includes('enetunreach') ||
    text.includes('econnreset') ||
    text.includes('connect etimedout') ||
    text.includes('no: 45012') ||
    /\b08s01\b/.test(text)
  );
}

function envPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Integer env var; `min` may be 0 (e.g. disable leak detection). */
function envInteger(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? Math.trunc(n) : fallback;
}

function poolLimits(options?: {readOnly?: boolean}) {
  const connectionLimit = options?.readOnly
    ? envPositiveNumber('DB_REPLICA_CONNECTION_LIMIT', envPositiveNumber('DB_CONNECTION_LIMIT', 20))
    : envPositiveNumber('DB_CONNECTION_LIMIT', 20);

  return {
    connectionLimit,
    connectTimeout: options?.readOnly
      ? envPositiveNumber('DB_REPLICA_CONNECT_TIMEOUT_MS', 3_000)
      : envPositiveNumber('DB_CONNECT_TIMEOUT_MS', 10_000),
    acquireTimeout: options?.readOnly
      ? envPositiveNumber('DB_REPLICA_ACQUIRE_TIMEOUT_MS', 5_000)
      : envPositiveNumber('DB_ACQUIRE_TIMEOUT_MS', 8_000),
    initializationTimeout: options?.readOnly
      ? envPositiveNumber(
          'DB_REPLICA_INITIALIZATION_TIMEOUT_MS',
          envPositiveNumber('DB_REPLICA_ACQUIRE_TIMEOUT_MS', 5_000),
        )
      : envPositiveNumber('DB_INITIALIZATION_TIMEOUT_MS', 15_000),
    idleTimeout: envPositiveNumber('DB_IDLE_TIMEOUT_SECONDS', 600),
    leakDetectionTimeout: envInteger('DB_LEAK_DETECTION_TIMEOUT_MS', 15_000, 0),
  };
}

export function describePrismaPoolSettings(options?: {readOnly?: boolean}) {
  const limits = poolLimits(options);
  return {
    connectionLimit: limits.connectionLimit,
    acquireTimeoutMs: limits.acquireTimeout,
    connectTimeoutMs: limits.connectTimeout,
    idleTimeoutSeconds: limits.idleTimeout,
    leakDetectionTimeoutMs: limits.leakDetectionTimeout,
  };
}

function createPoolConfig(databaseUrl: string, options?: {readOnly?: boolean}): PrismaMariaDbConfig {
  let url: URL;
  try {
    url = parseMysqlUrl(databaseUrl);
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

  const limits = poolLimits(options);

  const config: PrismaMariaDbConfig = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    // MySQL 8 caching_sha2_password over non-TLS needs the server RSA key;
    // without this, every connect fails and the pool times out at idle=0.
    allowPublicKeyRetrieval: process.env.DB_ALLOW_PUBLIC_KEY_RETRIEVAL !== 'false',
    connectTimeout: limits.connectTimeout,
    acquireTimeout: limits.acquireTimeout,
    initializationTimeout: limits.initializationTimeout,
    connectionLimit: limits.connectionLimit,
    // Seconds. Recycle idle sockets before MySQL wait_timeout drops them.
    idleTimeout: limits.idleTimeout,
    timezone: 'Z',
  };

  if (limits.leakDetectionTimeout > 0) {
    (config as PrismaMariaDbConfig & {leakDetectionTimeout?: number}).leakDetectionTimeout =
      limits.leakDetectionTimeout;
  }

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
  try {
    return createPrismaClient(replicaUrl, {readOnly: true});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[prisma] Replica disabled; LOS reads use primary. ${message}`);
    return null;
  }
}
