import { Injectable, Logger } from '@nestjs/common';
import {
  buildSpacesClientConfigFromEnv,
  DigitalOceanSpacesClient,
  inferRegionFromEndpoint,
  normalizeSpacesEndpoint,
} from './digitalocean-spaces.client';
import { resolveSpacesKeyPrefix, toPrefixedObjectKey } from './spaces-key-prefix.util';
import { resolveSpacesObjectAcl, spacesUsesPublicRead } from './spaces-public-read.util';

/**
 * DigitalOcean Spaces object storage (S3-compatible API, native HTTP client).
 * Configure via `SPACES_*` env vars — data stays in your DO bucket, not AWS.
 */
@Injectable()
export class SpacesObjectStorageService {
  private readonly logger = new Logger(SpacesObjectStorageService.name);
  private readonly client: DigitalOceanSpacesClient | null;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly presignedExpiresSec: number;

  constructor() {
    const config = buildSpacesClientConfigFromEnv();
    if (!config) {
      this.client = null;
      this.bucket = '';
      this.keyPrefix = '';
      this.presignedExpiresSec = 3600;
      warnIfSpacesExpectedButMissing();
      return;
    }

    this.bucket = config.bucket;
    this.keyPrefix = resolveSpacesKeyPrefix();
    this.presignedExpiresSec = parsePositiveInt(process.env.SPACES_PRESIGNED_EXPIRES_SEC, 3600);
    this.client = new DigitalOceanSpacesClient(config);

    this.logger.log(
      `DigitalOcean Spaces: bucket=${config.bucket} prefix=${this.keyPrefix}/ region=${config.region} publicRead=${spacesUsesPublicRead()}`,
    );
  }

  usesPublicRead(): boolean {
    return spacesUsesPublicRead();
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

  /** Public CDN / bucket origin base (no trailing slash). */
  publicBaseUrl(): string | null {
    const base = (process.env.STORAGE_BASE_URL ?? '').trim().replace(/\/+$/, '');
    return base || null;
  }

  publicObjectUrl(relativePath: string): string | null {
    if (!spacesUsesPublicRead()) return null;
    const base = this.publicBaseUrl();
    if (!base) return null;
    const rel = normalizeObjectKey(relativePath);
    return `${base}/${rel}`;
  }

  async putObject(relativePath: string, body: Buffer, contentType?: string): Promise<void> {
    const client = this.requireClient();
    const Key = this.toStorageKey(relativePath);
    await client.putObject(Key, body, contentType ?? contentTypeForKey(Key), resolveSpacesObjectAcl());
  }

  async getObject(relativePath: string): Promise<Buffer> {
    const client = this.requireClient();
    return client.getObject(this.toStorageKey(relativePath));
  }

  async exists(relativePath: string): Promise<boolean> {
    const client = this.requireClient();
    return client.headObject(this.toStorageKey(relativePath));
  }

  async presignedGetUrl(relativePath: string, expiresInSeconds?: number): Promise<string> {
    if (spacesUsesPublicRead()) {
      const publicUrl = this.publicObjectUrl(relativePath);
      if (publicUrl) return publicUrl;
      throw new Error('STORAGE_BASE_URL is required when SPACES_PUBLIC_READ is enabled.');
    }
    const client = this.requireClient();
    return client.presignedGetUrl(
      this.toStorageKey(relativePath),
      expiresInSeconds ?? this.presignedExpiresSec,
    );
  }

  private requireClient(): DigitalOceanSpacesClient {
    if (!this.client) {
      throw new Error(
        'DigitalOcean Spaces is not configured. Set SPACES_BUCKET, SPACES_ACCESS_KEY_ID, SPACES_SECRET_ACCESS_KEY, SPACES_ENDPOINT, and SPACES_REGION.',
      );
    }
    return this.client;
  }
}

export function usesSpacesStorage(): boolean {
  const driver = (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
  if (driver === 'local') return false;
  if (driver === 'spaces') return true;
  return Boolean((process.env.SPACES_BUCKET ?? '').trim());
}

export function normalizeObjectKey(relativePath: string): string {
  const key = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!key || key.includes('..')) {
    throw new Error('Invalid object key.');
  }
  return key;
}

function warnIfSpacesExpectedButMissing(): void {
  const driver = (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
  if (driver !== 'spaces') return;
  const logger = new Logger(SpacesObjectStorageService.name);
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

export { inferRegionFromEndpoint, normalizeSpacesEndpoint };
