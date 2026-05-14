import { Injectable } from '@nestjs/common';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * On-disk KYC artifacts (DigiLocker Aadhaar photo, customer selfie).
 *
 * Layout relative to {@link KycFilesService.rootDir} (see `KYC_FILES_ROOT`):
 *
 * ```
 * storage/                          ← default root = `<cwd>/storage`
 *   customer/
 *     {customer_uuid}/
 *       photos/
 *         aadhaar/
 *           {application_uuid}.{jpg|png}
 *         selfie/
 *           {application_uuid}.jpg
 * ```
 */
@Injectable()
export class KycFilesService {
  /** Absolute root; defaults to `<cwd>/storage` (parent of the `customer/` tree). */
  rootDir(): string {
    const raw = (process.env.KYC_FILES_ROOT ?? '').trim();
    if (raw) return path.resolve(raw);
    return path.join(process.cwd(), 'storage');
  }

  absolutePath(relativePath: string): string {
    const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (rel.includes('..')) {
      throw new Error('Invalid relative path.');
    }
    return path.join(this.rootDir(), rel);
  }

  async writeBytes(relativePath: string, data: Buffer): Promise<void> {
    const abs = this.absolutePath(relativePath);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, data);
  }

  async readBytes(relativePath: string): Promise<Buffer> {
    return readFile(this.absolutePath(relativePath));
  }

  aadhaarPhotoRelativePath(customerUuid: string, applicationUuid: string, ext: 'jpg' | 'png'): string {
    return `customer/${customerUuid}/photos/aadhaar/${applicationUuid}.${ext}`;
  }

  selfieRelativePath(customerUuid: string, applicationUuid: string): string {
    return `customer/${customerUuid}/photos/selfie/${applicationUuid}.jpg`;
  }
}
