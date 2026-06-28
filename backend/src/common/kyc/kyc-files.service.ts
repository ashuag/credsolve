import { Injectable } from '@nestjs/common';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveStorageKeyPrefix } from '../storage/spaces-key-prefix.util';
import { resolveStoragePublicBaseUrl } from '../storage/spaces-public-read.util';
import {
  normalizeObjectKey,
  SpacesObjectStorageService,
  usesRemoteObjectStorage,
} from '../storage/spaces-object-storage.service';

/**
 * Customer file storage (KYC photos, loan PDFs).
 *
 * When object storage is configured (`STORAGE_DRIVER=s3` or `spaces`), objects are stored in S3/Spaces.
 * Otherwise files are written under `KYC_FILES_ROOT` or `<cwd>/storage` for local development.
 *
 * Object keys (stored in DB) always use this layout:
 * ```
 * customer/{customer_uuid}/photos/aadhaar/{application_uuid}.{jpg|png}
 * customer/{customer_uuid}/photos/selfie/{application_uuid}.jpg
 * customer/{customer_uuid}/loan-documents/{application_uuid}/key-fact-statement.pdf
 * customer/{customer_uuid}/loan-documents/{application_uuid}/loan-agreement.pdf
 * ```
 */
@Injectable()
export class KycFilesService {
  constructor(private readonly spaces: SpacesObjectStorageService) {}

  usesObjectStorage(): boolean {
    return usesRemoteObjectStorage() && this.spaces.isConfigured();
  }

  /** @deprecated Use `usesObjectStorage`. */
  usesSpaces(): boolean {
    return this.usesObjectStorage();
  }

  /** Local disk root; mirrors storage prefix (`storage/local/customer/…`) when using shared bucket layout. */
  rootDir(): string {
    const raw = (process.env.KYC_FILES_ROOT ?? '').trim();
    if (raw) return path.resolve(raw);
    const base = path.join(process.cwd(), 'storage');
    if (usesRemoteObjectStorage()) {
      return path.join(base, resolveStorageKeyPrefix());
    }
    return base;
  }

  absolutePath(relativePath: string): string {
    const rel = normalizeObjectKey(relativePath);
    return path.join(this.rootDir(), rel);
  }

  async writeBytes(relativePath: string, data: Buffer): Promise<void> {
    const key = normalizeObjectKey(relativePath);
    if (this.usesObjectStorage()) {
      await this.spaces.putObject(key, data);
      return;
    }
    const abs = this.absolutePath(key);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, data);
  }

  async readBytes(relativePath: string): Promise<Buffer> {
    const key = normalizeObjectKey(relativePath);
    if (this.usesObjectStorage()) {
      return this.spaces.getObject(key);
    }
    return readFile(this.absolutePath(key));
  }

  async exists(relativePath: string): Promise<boolean> {
    const key = normalizeObjectKey(relativePath);
    if (this.usesObjectStorage()) {
      return this.spaces.exists(key);
    }
    try {
      await access(this.absolutePath(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Permanent public CDN URL, e.g. `https://mcashin.sgp1.cdn.digitaloceanspaces.com/local/customer/…` */
  publicReadUrl(relativePath: string): string | null {
    const key = normalizeObjectKey(relativePath);
    if (this.usesObjectStorage()) {
      return this.spaces.publicObjectUrl(key);
    }
    const base = resolveStoragePublicBaseUrl();
    if (!base) return null;
    return `${base}/${key}`;
  }

  /**
   * HTTPS URL Tenacio (or a browser) can fetch. With public object storage, uses `S3_URL` / `STORAGE_BASE_URL`.
   */
  async resolvePublicReadUrl(relativePath: string, expiresInSeconds?: number): Promise<string | null> {
    const publicUrl = this.publicReadUrl(relativePath);
    if (publicUrl) return publicUrl;
    if (this.usesObjectStorage()) {
      return this.spaces.presignedGetUrl(relativePath, expiresInSeconds);
    }
    return null;
  }

  aadhaarPhotoRelativePath(customerUuid: string, applicationUuid: string, ext: 'jpg' | 'png'): string {
    return `customer/${customerUuid}/photos/aadhaar/${applicationUuid}.${ext}`;
  }

  selfieRelativePath(customerUuid: string, applicationUuid: string): string {
    return `customer/${customerUuid}/photos/selfie/${applicationUuid}.jpg`;
  }

  loanDocumentPdfRelativePath(
    customerUuid: string,
    applicationUuid: string,
    fileName: 'key-fact-statement.pdf' | 'loan-agreement.pdf',
  ): string {
    return `customer/${customerUuid}/loan-documents/${applicationUuid}/${fileName}`;
  }
}
