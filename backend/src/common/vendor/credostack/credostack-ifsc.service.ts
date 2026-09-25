import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from '../vendor-api.service';

type VendorCallResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
};

const DEFAULT_IFSC_PATH = 'ifsc';

/**
 * IFSC lookup via Credostack `GET /{CREDOSTACK_IFSC_PATH}/{ifscCode}`.
 *
 * Env: `CREDOSTACK_URL` (base URL, shared across every Credostack integration),
 * `CREDOSTACK_CLIENT_CODE` (`X-Client-Code`), `CREDOSTACK_API_KEY` (`X-Api-Key`) — all required.
 * `CREDOSTACK_IFSC_PATH` (path segment, defaults to `ifsc`) — optional.
 */
@Injectable()
export class CredostackIfscService {
  private readonly logger = new Logger(CredostackIfscService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async lookupIfsc(ifscCode: string, leadId: bigint | null): Promise<VendorCallResult> {
    const baseUrl = (process.env.CREDOSTACK_URL ?? '').trim();
    const clientCode = (process.env.CREDOSTACK_CLIENT_CODE ?? '').trim();
    const apiKey = (process.env.CREDOSTACK_API_KEY ?? '').trim();
    const ifscPath = (process.env.CREDOSTACK_IFSC_PATH ?? '').trim() || DEFAULT_IFSC_PATH;
    if (!baseUrl || !clientCode || !apiKey) {
      return this.skip(
        'Credostack is not configured. Set CREDOSTACK_URL (base URL), ' +
          'CREDOSTACK_CLIENT_CODE (X-Client-Code) and CREDOSTACK_API_KEY (X-Api-Key).',
      );
    }

    const result = await this.vendorApi.request({
      providerName: 'Credostack',
      serviceName: 'ifsc-lookup',
      method: 'GET',
      baseUrl,
      path: `${ifscPath}/${encodeURIComponent(ifscCode)}`,
      headers: { 'X-Client-Code': clientCode, 'X-Api-Key': apiKey },
      leadId,
      sensitiveHeaderNames: ['x-api-key', 'x-client-code'],
    });

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody: result.body,
    };
  }

  private skip(skipReason: string): VendorCallResult {
    this.logger.warn(skipReason);
    return { configured: false, skipReason, ok: false, httpStatus: null, vendorBody: null };
  }
}
