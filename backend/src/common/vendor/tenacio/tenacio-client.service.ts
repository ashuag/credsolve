import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const TENACIO_PROVIDER = 'Tenacio';
export const TENACIO_SERVICE_PAN_NAME_DOB = 'pan-name-dob';

type TenacioPostResult = {
  httpStatus: number;
  body: unknown;
  requestPayload: { input: { panNumber: string; consent: boolean } };
  rawText: string;
};

@Injectable()
export class TenacioClientService {
  private readonly logger = new Logger(TenacioClientService.name);

  constructor(private readonly config: ConfigService) {}

  /** POST `/pan-name-dob` — sandbox base typically ends with `/api/v1/services`. */
  async postPanNameDob(panNumber: string): Promise<TenacioPostResult> {
    const baseUrl = this.resolveBaseUrl();
    const clientId = this.resolveClientId();
    const apiKey = this.resolveApiKey();
    if (!baseUrl || !clientId || !apiKey) {
      const missing: string[] = [];
      if (!baseUrl) missing.push('VENDOR_HOST or TENACIO_BASE_URL (no trailing slash issues — base must include …/services)');
      if (!clientId) missing.push('TENACIO_CLIENT_ID or client-id');
      if (!apiKey) missing.push('TENACIO_API_KEY or x-api-key');
      throw new InternalServerErrorException(
        `Tenacio API is not configured. Missing in environment: ${missing.join('; ')}. ` +
          'Put these in backend/.env (or inject into the API container). Optional: TENACIO_WORKFLOW_ID for workflow-id header.'
      );
    }

    const normalizedPan = panNumber.trim().toUpperCase();
    const requestPayload = { input: { panNumber: normalizedPan, consent: true } };
    const url = `${baseUrl.replace(/\/$/, '')}/${TENACIO_SERVICE_PAN_NAME_DOB}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'client-id': clientId,
      'x-api-key': apiKey,
    };
    const workflowId =
      this.getEnv('TENACIO_WORKFLOW_ID') ?? this.getEnv('workflow-id') ?? this.getEnv('WORKFLOW_ID');
    if (workflowId) {
      headers['workflow-id'] = workflowId.trim();
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
    });

    const rawText = await res.text();
    let body: unknown = null;
    try {
      body = rawText ? (JSON.parse(rawText) as unknown) : null;
    } catch {
      body = { _parseError: true, rawSnippet: rawText.slice(0, 2000) };
    }

    if (!res.ok) {
      this.logger.warn(`Tenacio HTTP ${res.status} for ${TENACIO_SERVICE_PAN_NAME_DOB}`);
    }

    return { httpStatus: res.status, body, requestPayload, rawText };
  }

  private resolveBaseUrl(): string {
    return (
      this.getEnv('VENDOR_HOST') ??
      this.getEnv('TENACIO_BASE_URL') ??
      this.getEnv('vendor_host') ??
      ''
    ).trim();
  }

  private resolveClientId(): string {
    return (this.getEnv('TENACIO_CLIENT_ID') ?? this.getEnv('client-id') ?? '').trim();
  }

  private resolveApiKey(): string {
    return (this.getEnv('TENACIO_API_KEY') ?? this.getEnv('x-api-key') ?? '').trim();
  }

  /**
   * Reads env vars. Prefer `process.env` first so hyphenated keys (`client-id`, `x-api-key`, `vendor_host`)
   * work reliably when loaded via dotenv; Nest `ConfigService` can omit non-standard keys depending on setup.
   */
  private getEnv(key: string): string | undefined {
    const direct = process.env[key];
    if (direct != null && String(direct).trim().length > 0) {
      return String(direct).trim();
    }
    const fromNest = this.config.get<string>(key);
    if (fromNest != null && String(fromNest).trim().length > 0) {
      return String(fromNest).trim();
    }
    return undefined;
  }
}
