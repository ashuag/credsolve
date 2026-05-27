import { Injectable, Logger } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * DigitalOcean Spaces object storage (S3-compatible API).
 *
 * We use `@aws-sdk/client-s3` only as an HTTP client for the Spaces endpoint — files are
 * stored in your DO bucket, not in AWS. Configure via `SPACES_*` env vars.
 */
@Injectable()
export class SpacesObjectStorageService {
  private readonly logger = new Logger(SpacesObjectStorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly presignedExpiresSec: number;

  constructor() {
    const bucket = (process.env.SPACES_BUCKET ?? '').trim();
    const accessKeyId = (process.env.SPACES_ACCESS_KEY_ID ?? '').trim();
    const secretAccessKey = (process.env.SPACES_SECRET_ACCESS_KEY ?? '').trim();
    const endpoint = normalizeSpacesEndpoint(process.env.SPACES_ENDPOINT ?? '');
    const region = (process.env.SPACES_REGION ?? '').trim() || inferRegionFromEndpoint(endpoint);

    if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
      this.client = null;
      this.bucket = '';
      this.presignedExpiresSec = 3600;
      return;
    }

    this.bucket = bucket;
    this.presignedExpiresSec = parsePositiveInt(process.env.SPACES_PRESIGNED_EXPIRES_SEC, 3600);

    this.client = new S3Client({
      endpoint,
      region: region || 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: false,
    });

    this.logger.log(`DigitalOcean Spaces: bucket=${bucket} endpoint=${endpoint}`);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  bucketName(): string | null {
    return this.bucket || null;
  }

  /** Public CDN / bucket origin base (no trailing slash), e.g. `https://moneycash-prod.blr1.cdn.digitaloceanspaces.com` */
  publicBaseUrl(): string | null {
    const base = (process.env.STORAGE_BASE_URL ?? '').trim().replace(/\/+$/, '');
    return base || null;
  }

  publicObjectUrl(objectKey: string): string | null {
    const base = this.publicBaseUrl();
    if (!base) return null;
    const key = normalizeObjectKey(objectKey);
    return `${base}/${key}`;
  }

  async putObject(objectKey: string, body: Buffer, contentType?: string): Promise<void> {
    const client = this.requireClient();
    const Key = normalizeObjectKey(objectKey);
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key,
        Body: body,
        ContentType: contentType ?? contentTypeForKey(Key),
      }),
    );
  }

  async getObject(objectKey: string): Promise<Buffer> {
    const client = this.requireClient();
    const out = await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: normalizeObjectKey(objectKey),
      }),
    );
    if (!out.Body) {
      throw new Error('Spaces object body is empty.');
    }
    return Buffer.from(await out.Body.transformToByteArray());
  }

  async exists(objectKey: string): Promise<boolean> {
    const client = this.requireClient();
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: normalizeObjectKey(objectKey),
        }),
      );
      return true;
    } catch (err) {
      const status = err && typeof err === 'object' && '$metadata' in err
        ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
      if (status === 404) return false;
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
      if (name === 'NotFound' || name === 'NoSuchKey') return false;
      throw err;
    }
  }

  async presignedGetUrl(objectKey: string, expiresInSeconds?: number): Promise<string> {
    const client = this.requireClient();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: normalizeObjectKey(objectKey),
    });
    return getSignedUrl(client, command, {
      expiresIn: expiresInSeconds ?? this.presignedExpiresSec,
    });
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new Error(
        'DigitalOcean Spaces is not configured. Set SPACES_BUCKET, SPACES_ACCESS_KEY_ID, SPACES_SECRET_ACCESS_KEY, and SPACES_ENDPOINT.',
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

function normalizeSpacesEndpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function inferRegionFromEndpoint(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname;
    const match = /^([a-z0-9]+)\.digitaloceanspaces\.com$/i.exec(host);
    return match?.[1] ?? '';
  } catch {
    return '';
  }
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
