#!/usr/bin/env node
/**
 * Upload `storage/customer/**` into DigitalOcean Spaces (same object keys as local layout).
 *
 * Loads backend/.env via dotenv. Requires SPACES_* variables.
 *
 *   npm run storage:migrate-to-spaces:dry-run
 *   npm run storage:migrate-to-spaces
 */
import { config } from 'dotenv';
import { createHash, createHmac } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');

function resolvePrefix() {
  const explicit = (process.env.SPACES_KEY_PREFIX ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (explicit) return explicit;
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') return 'prod';
  if (nodeEnv === 'staging') return 'staging';
  return 'local';
}
const EMPTY_PAYLOAD_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function storageRoot() {
  const raw = (process.env.KYC_FILES_ROOT ?? '').trim();
  if (raw) return path.resolve(raw);
  return path.join(path.resolve(__dirname, '..'), 'storage');
}

function normalizeEndpoint(raw) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function inferRegion(endpoint) {
  try {
    const host = new URL(endpoint).hostname;
    const m = /^([a-z0-9]+)\.digitaloceanspaces\.com$/i.exec(host);
    return m?.[1] ?? '';
  } catch {
    return '';
  }
}

function contentType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function encodeKey(key) {
  return key.split('/').map((p) => encodeURIComponent(p)).join('/');
}

function toAmzDate(d) {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function signingKey(secret, dateStamp, region) {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function resolveObjectAcl() {
  const raw = (process.env.SPACES_PUBLIC_READ ?? '').trim().toLowerCase();
  const publicRead =
    raw === 'true' || raw === '1' || raw === 'yes' || Boolean((process.env.STORAGE_BASE_URL ?? '').trim());
  if (!publicRead || raw === 'false' || raw === '0') return undefined;
  return (process.env.SPACES_OBJECT_ACL ?? 'public-read').trim() || 'public-read';
}

async function putObject({ bucket, region, accessKeyId, secretAccessKey, key, body, contentType, acl }) {
  const host = `${bucket}.${region}.digitaloceanspaces.com`;
  const objectPath = `/${encodeKey(key)}`;
  const payloadHash = sha256Hex(body);
  const amzDate = toAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const headers = {
    host,
    'content-type': contentType,
    'content-length': String(body.length),
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };
  if (acl) headers['x-amz-acl'] = acl;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n].trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = ['PUT', objectPath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(secretAccessKey, dateStamp, region), stringToSign).toString('hex');
  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${objectPath}`, { method: 'PUT', headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PUT ${key} failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

async function walkFiles(dir, baseDir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(abs, baseDir, out);
      continue;
    }
    if (entry.isFile()) {
      out.push({ abs, key: path.relative(baseDir, abs).replace(/\\/g, '/') });
    }
  }
}

async function main() {
  const bucket = (process.env.SPACES_BUCKET ?? '').trim();
  const accessKeyId = (process.env.SPACES_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = (process.env.SPACES_SECRET_ACCESS_KEY ?? '').trim();
  const endpoint = normalizeEndpoint(process.env.SPACES_ENDPOINT ?? '');
  const region = (process.env.SPACES_REGION ?? '').trim() || inferRegion(endpoint);

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint || !region) {
    console.error('Set SPACES_BUCKET, SPACES_ACCESS_KEY_ID, SPACES_SECRET_ACCESS_KEY, SPACES_ENDPOINT, SPACES_REGION.');
    process.exit(1);
  }

  const root = storageRoot();
  const customerDir = path.join(root, 'customer');
  if (!(await stat(customerDir).catch(() => null))?.isDirectory()) {
    console.warn(`No ${customerDir}`);
    process.exit(0);
  }

  const prefix = resolvePrefix();
  const objectAcl = resolveObjectAcl();
  const files = [];
  await walkFiles(customerDir, root, files);
  console.log(
    `${dryRun ? '[dry-run] ' : ''}${files.length} file(s) from ${root} → s3://${bucket}/${prefix}/… (${region})`,
  );

  let ok = 0;
  let fail = 0;
  for (const { abs, key } of files) {
    try {
      if (dryRun) {
        console.log(`  would upload: ${key}`);
        ok++;
        continue;
      }
      const body = await readFile(abs);
      const objectKey = prefix ? `${prefix}/${key}` : key;
      await putObject({
        bucket,
        region,
        accessKeyId,
        secretAccessKey,
        key: objectKey,
        body,
        contentType: contentType(path.basename(key)),
        acl: objectAcl,
      });
      console.log(`  uploaded: ${objectKey}`);
      ok++;
    } catch (err) {
      console.error(`  failed: ${key}`, err instanceof Error ? err.message : err);
      fail++;
    }
  }
  console.log(`Done. ${ok} ok, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
