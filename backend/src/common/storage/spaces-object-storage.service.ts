import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  buildObjectStorageClientConfigFromEnv,
  S3CompatibleClient,
  inferRegionFromEndpoint,
  normalizeSpacesEndpoint,
} from './digitalocean-spaces.client';
import { resolveStorageKeyPrefix, toPrefixedObjectKey } from './spaces-key-prefix.util';
import {
  objectStorageUsesPublicRead,
  resolveObjectStorageAcl,
  resolveStoragePublicBaseUrl,
  buildStoragePublicObjectUrl,
} from './spaces-public-read.util';

/**
 * S3-compatible object storage (AWS S3 or DigitalOcean Spaces, native HTTP client).
 * Configure via `STORAGE_DRIVER=s3` + `AWS_*` / `S3_*`, or `STORAGE_DRIVER=spaces` + `SPACES_*`.
 */
@Injectable()
export class SpacesObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(SpacesObjectStorageService.name);
  private readonly client: S3CompatibleClient | null;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly presignedExpiresSec: number;
  private readonly usesInstanceIamRole: boolean;

  constructor() {
    const built = buildObjectStorageClientConfigFromEnv();
    if (!built) {
      this.client = null;
      this.bucket = '';
      this.keyPrefix = '';
      this.presignedExpiresSec = 3600;
      this.usesInstanceIamRole = false;
      warnIfRemoteStorageExpectedButMissing();
      return;
    }

    const { config, provider } = built;
    this.bucket = config.bucket;
    this.keyPrefix = resolveStorageKeyPrefix();
    this.presignedExpiresSec = parsePositiveInt(
      process.env.S3_PRESIGNED_EXPIRES_SEC ?? process.env.SPACES_PRESIGNED_EXPIRES_SEC,
      3600,
    );
    this.usesInstanceIamRole = provider === 's3' && Boolean(config.getCredentials);
    this.client = new S3CompatibleClient(config);

    const label = provider === 's3' ? 'AWS S3' : 'DigitalOcean Spaces';
    const authMode =
      provider === 's3'
        ? this.usesInstanceIamRole
          ? 'auth=ec2-iam-role'
          : 'auth=env-keys'
        : 'auth=env-keys';
    this.logger.log(
      `${label}: bucket=${config.bucket} prefix=${this.keyPrefix}/ region=${config.region} ${authMode} publicRead=${objectStorageUsesPublicRead()}`,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.client || !this.usesInstanceIamRole) return;
    try {
      await this.client.verifyCredentials();
      this.logger.log('AWS S3: EC2 instance IAM role credentials resolved successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AWS S3: instance IAM credentials unavailable at startup — ${message}`);
    }
  }

  usesPublicRead(): boolean {
    return objectStorageUsesPublicRead();
  }

  /** Prefix folder inside the bucket, e.g. `local`, `staging`, `prod`. */
  objectKeyPrefix(): string {
    return this.keyPrefix;
  }

  private toStorageKey(relativePath: string): string {
    return toPrefixedObjectKey(normalizeObjectKey(relativePath), this.keyPrefix);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  bucketName(): string | null {
    return this.bucket || null;
  }

  /** Public CDN / bucket origin base (no trailing slash). Uses `S3_URL` or `STORAGE_BASE_URL`. */
  publicBaseUrl(): string | null {
    return resolveStoragePublicBaseUrl();
  }

  publicObjectUrl(relativePath: string): string | null {
    if (!objectStorageUsesPublicRead()) return null;
    return buildStoragePublicObjectUrl(relativePath, this.publicBaseUrl());
  }

  async putObject(relativePath: string, body: Buffer, contentType?: string): Promise<void> {
    const client = this.requireClient();
    const Key = this.toStorageKey(relativePath);
    await client.putObject(Key, body, contentType ?? contentTypeForKey(Key), resolveObjectStorageAcl());
  }

  async getObject(relativePath: string): Promise<Buffer> {
    const client = this.requireClient();
    return this.getObjectWithLegacyFallback(client, relativePath);
  }

  async exists(relativePath: string): Promise<boolean> {
    const client = this.requireClient();
    return this.existsWithLegacyFallback(client, relativePath);
  }

  /** Try prefixed key first, then unprefixed (objects uploaded before `SPACES_KEY_PREFIX`). */
  private async getObjectWithLegacyFallback(
    client: S3CompatibleClient,
    relativePath: string,
  ): Promise<Buffer> {
    const prefixedKey = this.toStorageKey(relativePath);
    try {
      return await client.getObject(prefixedKey);
    } catch (err) {
      if (!isNoSuchKeyError(err) || !this.keyPrefix) throw err;
      const legacyKey = normalizeObjectKey(relativePath);
      if (legacyKey === prefixedKey) throw err;
      return client.getObject(legacyKey);
    }
  }

  private async existsWithLegacyFallback(client: S3CompatibleClient, relativePath: string): Promise<boolean> {
    const prefixedKey = this.toStorageKey(relativePath);
    if (await client.headObject(prefixedKey)) return true;
    if (!this.keyPrefix) return false;
    const legacyKey = normalizeObjectKey(relativePath);
    if (legacyKey === prefixedKey) return false;
    return client.headObject(legacyKey);
  }

  async presignedGetUrl(relativePath: string, expiresInSeconds?: number): Promise<string> {
    if (objectStorageUsesPublicRead()) {
      const publicUrl = this.publicObjectUrl(relativePath);
      if (publicUrl) return publicUrl;
      throw new Error('S3_URL or STORAGE_BASE_URL is required when object storage public read is enabled.');
    }
    const client = this.requireClient();
    return client.presignedGetUrl(
      this.toStorageKey(relativePath),
      expiresInSeconds ?? this.presignedExpiresSec,
    );
  }

  private requireClient(): S3CompatibleClient {
    if (!this.client) {
      throw new Error(
        'Object storage is not configured. Set STORAGE_DRIVER=s3 with AWS_REGION and S3_CUSTOMER_BUCKET (EC2 IAM role or AWS_ACCESS_KEY_ID), or STORAGE_DRIVER=spaces with SPACES_* vars.',
      );
    }
    return this.client;
  }
}

export function usesRemoteObjectStorage(): boolean {
  const driver = (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
  if (driver === 'local') return false;
  if (driver === 's3' || driver === 'aws' || driver === 'spaces') return true;
  return Boolean(
    (process.env.S3_CUSTOMER_BUCKET ?? process.env.S3_BUCKET ?? process.env.SPACES_BUCKET ?? '').trim(),
  );
}

/** @deprecated Use `usesRemoteObjectStorage`. */
export function usesSpacesStorage(): boolean {
  return usesRemoteObjectStorage();
}

export function normalizeObjectKey(relativePath: string): string {
  const key = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!key || key.includes('..')) {
    throw new Error('Invalid object key.');
  }
  return key;
}

function warnIfRemoteStorageExpectedButMissing(): void {
  const driver = (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
  if (driver !== 'spaces' && driver !== 's3' && driver !== 'aws') return;
  const logger = new Logger(SpacesObjectStorageService.name);
  if (driver === 's3' || driver === 'aws') {
    logger.warn(
      'STORAGE_DRIVER=s3 but AWS_REGION / S3_CUSTOMER_BUCKET are incomplete. Falling back to local disk.',
    );
    return;
  }
  logger.warn(
    'STORAGE_DRIVER=spaces but SPACES_BUCKET / SPACES_ACCESS_KEY_ID / SPACES_SECRET_ACCESS_KEY / SPACES_ENDPOINT are incomplete. Falling back to local disk.',
  );
}

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isNoSuchKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('NoSuchKey') || msg.includes('S3 GET failed (404)') || msg.includes('S3 HEAD failed (404)');
}

export { inferRegionFromEndpoint, normalizeSpacesEndpoint };
