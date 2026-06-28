import { createHash, createHmac } from 'node:crypto';
import { resolveAwsSigningCredentials, type AwsSigningCredentials } from './aws-instance-credentials.util';

export type { AwsSigningCredentials };

export type SpacesClientConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  host: string;
  /** Static credentials (Spaces or local dev). Omit when `getCredentials` is set. */
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /** EC2/ECS IAM role — used when static keys are not in env. */
  getCredentials?: () => Promise<AwsSigningCredentials>;
};

export type ObjectStorageProvider = 's3' | 'spaces';

const EMPTY_PAYLOAD_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * Minimal S3-compatible client (AWS S3 or DigitalOcean Spaces, no third-party SDK).
 */
export class S3CompatibleClient {
  constructor(private readonly config: SpacesClientConfig) {}

  private host(): string {
    return this.config.host;
  }

  async putObject(key: string, body: Buffer, contentType: string, acl?: string): Promise<void> {
    const path = `/${encodeObjectKey(key)}`;
    const payloadHash = sha256Hex(body);
    const headers: Record<string, string> = {
      host: this.host(),
      'content-type': contentType,
      'content-length': String(body.length),
    };
    if (acl?.trim()) {
      headers['x-amz-acl'] = acl.trim();
    }
    const creds = await this.resolveCredentials();
    const signed = this.signRequest({
      method: 'PUT',
      path,
      headers,
      payloadHash,
      credentials: creds,
    });
    const res = await fetch(`https://${this.host()}${path}`, {
      method: 'PUT',
      headers: signed,
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`S3 PUT failed (${res.status}): ${text.slice(0, 500)}`);
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const path = `/${encodeObjectKey(key)}`;
    const creds = await this.resolveCredentials();
    const signed = this.signRequest({
      method: 'GET',
      path,
      headers: { host: this.host() },
      payloadHash: EMPTY_PAYLOAD_HASH,
      credentials: creds,
    });
    const res = await fetch(`https://${this.host()}${path}`, {
      method: 'GET',
      headers: signed,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`S3 GET failed (${res.status}): ${text.slice(0, 500)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async headObject(key: string): Promise<boolean> {
    const path = `/${encodeObjectKey(key)}`;
    const creds = await this.resolveCredentials();
    const signed = this.signRequest({
      method: 'HEAD',
      path,
      headers: { host: this.host() },
      payloadHash: EMPTY_PAYLOAD_HASH,
      credentials: creds,
    });
    const res = await fetch(`https://${this.host()}${path}`, {
      method: 'HEAD',
      headers: signed,
    });
    if (res.status === 404) return false;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`S3 HEAD failed (${res.status}): ${text.slice(0, 500)}`);
    }
    return true;
  }

  async presignedGetUrl(key: string, expiresInSeconds: number): Promise<string> {
    const creds = await this.resolveCredentials();
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const host = this.host();
    const path = `/${encodeObjectKey(key)}`;

    const query: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${creds.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': 'host',
    };
    if (creds.sessionToken) {
      query['X-Amz-Security-Token'] = creds.sessionToken;
    }

    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k]!)}`)
      .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const canonicalRequest = ['GET', path, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join(
      '\n',
    );

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSigningKey(creds.secretAccessKey, dateStamp, this.config.region, 's3');
    const signature = hmacHex(signingKey, stringToSign);

    return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }

  private async resolveCredentials(): Promise<AwsSigningCredentials> {
    if (this.config.getCredentials) {
      return this.config.getCredentials();
    }
    const accessKeyId = this.config.accessKeyId?.trim();
    const secretAccessKey = this.config.secretAccessKey?.trim();
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 credentials are not configured.');
    }
    return {
      accessKeyId,
      secretAccessKey,
      sessionToken: this.config.sessionToken?.trim() || undefined,
    };
  }

  /** Startup probe for EC2 IAM role credentials. */
  async verifyCredentials(): Promise<void> {
    await this.resolveCredentials();
  }

  private signRequest(params: {
    method: string;
    path: string;
    headers: Record<string, string>;
    payloadHash: string;
    credentials: AwsSigningCredentials;
  }): Record<string, string> {
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;

    const headers: Record<string, string> = {
      ...params.headers,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': params.payloadHash,
    };
    if (params.credentials.sessionToken) {
      headers['x-amz-security-token'] = params.credentials.sessionToken;
    }

    const sortedNames = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort();

    const canonicalHeaders = sortedNames.map((name) => `${name}:${headerValue(headers, name)}\n`).join('');
    const signedHeaders = sortedNames.join(';');

    const canonicalRequest = [
      params.method,
      params.path,
      '',
      canonicalHeaders,
      signedHeaders,
      params.payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSigningKey(params.credentials.secretAccessKey, dateStamp, this.config.region, 's3');
    const signature = hmacHex(signingKey, stringToSign);
    const authorization = `AWS4-HMAC-SHA256 Credential=${params.credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return { ...headers, Authorization: authorization };
  }
}

function headerValue(headers: Record<string, string>, lowerName: string): string {
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === lowerName);
  return (entry?.[1] ?? '').trim();
}

/** @deprecated Use `S3CompatibleClient`. */
export const DigitalOceanSpacesClient = S3CompatibleClient;

export function buildSpacesClientConfigFromEnv(): SpacesClientConfig | null {
  const bucket = (process.env.SPACES_BUCKET ?? '').trim();
  const accessKeyId = (process.env.SPACES_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = (process.env.SPACES_SECRET_ACCESS_KEY ?? '').trim();
  const endpoint = normalizeSpacesEndpoint(process.env.SPACES_ENDPOINT ?? '');
  const region = (process.env.SPACES_REGION ?? '').trim() || inferRegionFromEndpoint(endpoint);
  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint || !region) {
    return null;
  }
  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint,
    region,
    host: `${bucket}.${region}.digitaloceanspaces.com`,
  };
}

export function buildAwsS3ClientConfigFromEnv(): SpacesClientConfig | null {
  const bucket = (process.env.S3_CUSTOMER_BUCKET ?? process.env.S3_BUCKET ?? '').trim();
  const region = (process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? '').trim();
  if (!bucket || !region) {
    return null;
  }
  const endpoint = normalizeS3Endpoint(process.env.S3_ENDPOINT ?? '');
  const host = endpoint ? hostFromEndpoint(endpoint) : `${bucket}.s3.${region}.amazonaws.com`;
  const base = {
    bucket,
    region,
    endpoint: endpoint || `https://${host}`,
    host,
  };

  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY ?? '').trim();
  if (accessKeyId && secretAccessKey) {
    return {
      ...base,
      accessKeyId,
      secretAccessKey,
      sessionToken: (process.env.AWS_SESSION_TOKEN ?? '').trim() || undefined,
    };
  }

  return {
    ...base,
    getCredentials: resolveAwsSigningCredentials,
  };
}

export function buildObjectStorageClientConfigFromEnv(): {
  config: SpacesClientConfig;
  provider: ObjectStorageProvider;
} | null {
  const driver = (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
  if (driver === 's3' || driver === 'aws') {
    const config = buildAwsS3ClientConfigFromEnv();
    return config ? { config, provider: 's3' } : null;
  }
  if (driver === 'spaces' || driver === '') {
    const config = buildSpacesClientConfigFromEnv();
    return config ? { config, provider: 'spaces' } : null;
  }
  return null;
}

export function normalizeS3Endpoint(raw: string): string {
  return normalizeSpacesEndpoint(raw);
}

function hostFromEndpoint(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return '';
  }
}

export function normalizeSpacesEndpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function inferRegionFromEndpoint(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname;
    const match = /^([a-z0-9]+)\.digitaloceanspaces\.com$/i.exec(host);
    return match?.[1] ?? '';
  } catch {
    return '';
  }
}

function encodeObjectKey(key: string): string {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacHex(key: Buffer, data: string): string {
  return hmac(key, data).toString('hex');
}

function getSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}
