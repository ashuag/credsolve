import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AwsS3SdkClient,
  buildAwsS3SdkConfigFromEnv,
} from './aws-s3-sdk.client';
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

type ObjectStorageClient = Pick<
  S3CompatibleClient,
  'putObject' | 'getObject' | 'headObject' | 'presignedGetUrl'
>;

/**
 * S3-compatible object storage (AWS S3 or DigitalOcean Spaces).
 * AWS S3 uses `@aws-sdk/client-s3` (default credential chain). Spaces uses a native HTTP client.
 */
@Injectable()
export class SpacesObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(SpacesObjectStorageService.name);
  private readonly client: ObjectStorageClient | null;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly presignedExpiresSec: number;
  private readonly awsSdkClient: AwsS3SdkClient | null;
  /** False until AWS SDK credentials are verified at startup (AWS S3 only). */
  private s3CredentialsReady = false;

  constructor() {
    const driver = (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
    const s3SdkConfig =
      driver === 's3' || driver === 'aws' ? buildAwsS3SdkConfigFromEnv() : null;
    const spacesBuilt = s3SdkConfig ? null : buildObjectStorageClientConfigFromEnv();

    if (s3SdkConfig) {
      this.awsSdkClient = new AwsS3SdkClient(s3SdkConfig);
      this.client = this.awsSdkClient;
      this.bucket = s3SdkConfig.bucket;
      this.keyPrefix = resolveStorageKeyPrefix();
      this.presignedExpiresSec = parsePositiveInt(
        process.env.S3_PRESIGNED_EXPIRES_SEC ?? process.env.SPACES_PRESIGNED_EXPIRES_SEC,
        3600,
      );
      const authMode = this.awsSdkClient.usesDefaultCredentialChain()
        ? 'auth=default-credential-chain'
        : 'auth=env-keys';
      this.logger.log(
        `AWS S3: bucket=${s3SdkConfig.bucket} prefix=${this.keyPrefix}/ region=${s3SdkConfig.region} ${authMode} publicRead=${objectStorageUsesPublicRead()}`,
      );
      return;
    }

    this.awsSdkClient = null;
    if (!spacesBuilt) {
      this.client = null;
      this.bucket = '';
      this.keyPrefix = '';
      this.presignedExpiresSec = 3600;
      return;
    }

    const { config } = spacesBuilt;
    this.bucket = config.bucket;
    this.keyPrefix = resolveStorageKeyPrefix();
    this.presignedExpiresSec = parsePositiveInt(
      process.env.S3_PRESIGNED_EXPIRES_SEC ?? process.env.SPACES_PRESIGNED_EXPIRES_SEC,
      3600,
    );
    this.client = new S3CompatibleClient(config);
    this.logger.log(
      `DigitalOcean Spaces: bucket=${config.bucket} prefix=${this.keyPrefix}/ region=${config.region} auth=env-keys publicRead=${objectStorageUsesPublicRead()}`,
    );
  }

  async onModuleInit(): Promise<void> {
    const driver = resolveStorageDriver();
    if (driver === 's3' || driver === 'aws') {
      if (!this.awsSdkClient) {
        throw new Error(
          'STORAGE_DRIVER=s3 but S3 is not fully configured. Set AWS_REGION and S3_CUSTOMER_BUCKET.',
        );
      }
      try {
        await this.awsSdkClient.verifyCredentials(this.keyPrefix);
        this.s3CredentialsReady = true;
        this.logger.log('AWS S3: credentials resolved successfully.');
      } catch (err) {
        this.s3CredentialsReady = false;
        const message = err instanceof Error ? err.message : String(err);
        const signatureMismatch = /signaturedoesnotmatch/i.test(message);
        const accessDenied =
          !signatureMismatch &&
          (/accessdenied|not authorized|403/i.test(message) ||
            (err &&
              typeof err === 'object' &&
              '$metadata' in err &&
              (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 403));
        throw new Error(
          signatureMismatch
            ? `AWS S3: invalid credentials (SignatureDoesNotMatch). Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in backend/.env — quote the secret if it contains / or +, and do not add a trailing period. ${message}`
            : accessDenied
              ? `AWS S3: access denied for bucket "${this.bucket}". Attach s3:PutObject and s3:GetObject on arn:aws:s3:::${this.bucket}/${this.keyPrefix}/* to the IAM user or role. ${message}`
              : `AWS S3: credentials unavailable. ${message}`,
        );
      }
      return;
    }

    if (driver === 'spaces' && !this.client) {
      throw new Error(
        'STORAGE_DRIVER=spaces but SPACES_BUCKET / SPACES_ACCESS_KEY_ID / SPACES_SECRET_ACCESS_KEY / SPACES_ENDPOINT are incomplete.',
      );
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
    if (!this.client) return false;
    if (this.awsSdkClient && !this.s3CredentialsReady) return false;
    return true;
  }

  assertConfigured(): void {
    if (this.isConfigured()) return;
    const driver = resolveStorageDriver();
    if (driver === 's3' || driver === 'aws') {
      throw new Error(
        'Object storage is not ready. Set STORAGE_DRIVER=s3 with AWS_REGION, S3_CUSTOMER_BUCKET, and valid AWS credentials.',
      );
    }
    if (driver === 'spaces') {
      throw new Error(
        'Object storage is not configured. Set STORAGE_DRIVER=spaces with SPACES_BUCKET, SPACES_ACCESS_KEY_ID, SPACES_SECRET_ACCESS_KEY, and SPACES_ENDPOINT.',
      );
    }
    throw new Error(
      'Object storage is not configured. Set STORAGE_DRIVER=s3 (recommended) or STORAGE_DRIVER=spaces.',
    );
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
    this.logger.debug(`S3 PUT s3://${this.bucket}/${Key} (${body.length} bytes)`);
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
    client: ObjectStorageClient,
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

  private async existsWithLegacyFallback(
    client: ObjectStorageClient,
    relativePath: string,
  ): Promise<boolean> {
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

  private requireClient(): ObjectStorageClient {
    if (!this.client) {
      throw new Error(
        'Object storage is not configured. Set STORAGE_DRIVER=s3 with AWS_REGION and S3_CUSTOMER_BUCKET (AWS SDK default credentials), or STORAGE_DRIVER=spaces with SPACES_* vars.',
      );
    }
    return this.client;
  }
}

export function usesRemoteObjectStorage(): boolean {
  const driver = resolveStorageDriver();
  if (driver === 's3' || driver === 'aws' || driver === 'spaces') return true;
  return Boolean(
    (process.env.S3_CUSTOMER_BUCKET ?? process.env.S3_BUCKET ?? process.env.SPACES_BUCKET ?? '').trim(),
  );
}

function resolveStorageDriver(): string {
  return (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
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
  const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
  return (
    name === 'NoSuchKey' ||
    msg.includes('NoSuchKey') ||
    msg.includes('S3 GET failed (404)') ||
    msg.includes('S3 HEAD failed (404)')
  );
}

export { inferRegionFromEndpoint, normalizeSpacesEndpoint };
