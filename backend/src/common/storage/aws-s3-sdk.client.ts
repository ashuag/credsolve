import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { hasStaticAwsCredentials } from './aws-instance-credentials.util';

export type AwsS3SdkClientConfig = {
  region: string;
  bucket: string;
  /** Optional custom endpoint (LocalStack, MinIO). */
  endpoint?: string;
};

/**
 * AWS S3 via official SDK — credentials from the default provider chain
 * (AWS_ACCESS_KEY_ID env vars, shared config, EC2/ECS instance role, etc.).
 */
export class AwsS3SdkClient {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: AwsS3SdkClientConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint?.trim()
        ? { endpoint: config.endpoint.trim(), forcePathStyle: true }
        : {}),
    });
  }

  usesDefaultCredentialChain(): boolean {
    return !hasStaticAwsCredentials();
  }

  async putObject(key: string, body: Buffer, contentType: string, acl?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(acl?.trim() ? { ACL: acl.trim() as 'public-read' } : {}),
      }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    if (!res.Body) {
      throw new Error('S3 GET failed (empty body).');
    }
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async headObject(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (err) {
      if (isS3NotFound(err)) {
        return false;
      }
      throw new Error(`S3 HEAD failed: ${formatS3Error(err)}`);
    }
  }

  async presignedGetUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async verifyCredentials(objectKeyPrefix?: string): Promise<void> {
    const prefix = (objectKeyPrefix ?? '').trim().replace(/^\/+|\/+$/g, '');
    const probeKey = prefix ? `${prefix}/.moneycash-s3-healthcheck` : '.moneycash-s3-healthcheck';
    const body = Buffer.from('ok', 'utf8');
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: probeKey,
          Body: body,
          ContentType: 'text/plain',
        }),
      );
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: probeKey,
        }),
      );
    } catch (err) {
      throw new Error(formatS3Error(err));
    }
  }
}

function isS3NotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err ? String(err.name) : '';
  const code = 'Code' in err ? String((err as { Code?: string }).Code) : '';
  const status =
    '$metadata' in err
      ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
  return (
    name === 'NotFound' ||
    code === 'NotFound' ||
    code === 'NoSuchKey' ||
    code === '404' ||
    status === 404
  );
}

function formatS3Error(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err);
  const parts: string[] = [];
  const name = 'name' in err ? String(err.name) : '';
  const code = 'Code' in err ? String((err as { Code?: string }).Code) : '';
  const message = err instanceof Error ? err.message : '';
  const status =
    '$metadata' in err
      ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
  if (code && code !== name) parts.push(code);
  else if (name) parts.push(name);
  if (status) parts.push(`HTTP ${status}`);
  if (message && message !== name && message !== code) parts.push(message);
  return parts.join(' — ') || 'unknown S3 error';
}

export function buildAwsS3SdkConfigFromEnv(): AwsS3SdkClientConfig | null {
  const bucket = (process.env.S3_CUSTOMER_BUCKET ?? process.env.S3_BUCKET ?? '').trim();
  const region = (process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? '').trim();
  if (!bucket || !region) {
    return null;
  }
  const endpoint = (process.env.S3_ENDPOINT ?? '').trim();
  return {
    bucket,
    region,
    endpoint: endpoint || undefined,
  };
}
