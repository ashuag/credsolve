import { Injectable } from '@nestjs/common';
import {
  normalizeObjectKey,
  SpacesObjectStorageService,
} from '../storage/spaces-object-storage.service';

/**
 * Customer file storage (KYC photos, loan PDFs, bureau reports).
 *
 * All objects are stored in S3-compatible object storage (`STORAGE_DRIVER=s3` or `spaces`).
 *
 * Object keys (stored in DB):
 * ```
 * customer/{customer_uuid}/photos/aadhaar/{application_uuid}.{jpg|png}
 * customer/{customer_uuid}/photos/selfie/{application_uuid}.jpg
 * customer/{customer_uuid}/loan-documents/{application_uuid}/key-fact-statement.pdf
 * customer/{customer_uuid}/loan-documents/{application_uuid}/loan-agreement.pdf
 * customer/{customer_uuid}/bureau-reports/{bureau_report_uuid}/cibil-summary-report.pdf
 * ```
 */
@Injectable()
export class KycFilesService {
  constructor(private readonly spaces: SpacesObjectStorageService) {}

  usesObjectStorage(): boolean {
    return this.spaces.isConfigured();
  }

  /** @deprecated Use `usesObjectStorage`. */
  usesSpaces(): boolean {
    return this.usesObjectStorage();
  }

  private assertConfigured(): void {
    this.spaces.assertConfigured();
  }

  async writeBytes(relativePath: string, data: Buffer): Promise<void> {
    const key = normalizeObjectKey(relativePath);
    this.assertConfigured();
    await this.spaces.putObject(key, data);
  }

  async readBytes(relativePath: string): Promise<Buffer> {
    const key = normalizeObjectKey(relativePath);
    this.assertConfigured();
    return this.spaces.getObject(key);
  }

  async exists(relativePath: string): Promise<boolean> {
    const key = normalizeObjectKey(relativePath);
    this.assertConfigured();
    return this.spaces.exists(key);
  }

  /** Permanent public CDN URL when `S3_PUBLIC_READ=true` and `S3_URL` / `STORAGE_BASE_URL` is set. */
  publicReadUrl(relativePath: string): string | null {
    const key = normalizeObjectKey(relativePath);
    if (!this.usesObjectStorage()) return null;
    return this.spaces.publicObjectUrl(key);
  }

  /**
   * HTTPS URL Tenacio (or a browser) can fetch. With public object storage, uses `S3_URL` / `STORAGE_BASE_URL`;
   * otherwise returns a presigned S3 URL.
   */
  async resolvePublicReadUrl(relativePath: string, expiresInSeconds?: number): Promise<string | null> {
    if (!this.usesObjectStorage()) return null;
    const publicUrl = this.publicReadUrl(relativePath);
    if (publicUrl) return publicUrl;
    return this.spaces.presignedGetUrl(relativePath, expiresInSeconds);
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
