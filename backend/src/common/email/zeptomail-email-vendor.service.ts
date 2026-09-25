import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VendorApiService } from '../vendor/vendor-api.service';
import { resolveEmailProviderName, maskOtpInEmailBody } from './email-vendor-audit.util';
import {
  resolveEmailFromConfig,
  resolveEmailPassword,
  resolveZeptomailApiUrl,
} from './email-env.util';
import type { EmailAttachment, SendEmailAuditContext } from './email.types';

type ZeptomailAttachment = {
  name: string;
  content: string;
  mime_type: string;
};

type ZeptomailSendBody = {
  from: { address: string; name?: string };
  to: Array<{ email_address: { address: string; name?: string } }>;
  subject: string;
  htmlbody: string;
  textbody?: string;
  attachments?: ZeptomailAttachment[];
};

export type ZeptomailEmailSendInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
  /** Override default EMAIL_FROM when set (sanction / NOC). */
  from?: { address: string; name?: string };
  audit?: SendEmailAuditContext;
};

export type ZeptomailEmailSendResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
};

@Injectable()
export class ZeptomailEmailVendorService {
  constructor(
    private readonly config: ConfigService,
    private readonly vendorApi: VendorApiService,
  ) {}

  isConfigured(): boolean {
    return Boolean(resolveEmailFromConfig(this.config) && resolveEmailPassword(this.config));
  }

  async send(input: ZeptomailEmailSendInput): Promise<ZeptomailEmailSendResult> {
    const defaultFrom = resolveEmailFromConfig(this.config);
    const token = resolveEmailPassword(this.config);
    const apiUrl = resolveZeptomailApiUrl(this.config);

    const fromAddress = input.from?.address?.trim() || defaultFrom?.fromAddress || '';
    const fromName = input.from?.name?.trim() || defaultFrom?.fromName || 'MoneyCash';

    if (!fromAddress || !token) {
      throw new Error('EMAIL_FROM and EMAIL_AUTH_KEY (Zeptomail send-mail token) are required');
    }

    const attachments = (input.attachments ?? []).map((attachment) => ({
      name: attachment.filename.slice(0, 150),
      content: attachment.content.toString('base64'),
      mime_type: attachment.contentType ?? guessMimeType(attachment.filename),
    }));

    const body: ZeptomailSendBody = {
      from: { address: fromAddress, name: fromName },
      to: [{ email_address: { address: input.to } }],
      subject: input.subject.slice(0, 500),
      htmlbody: input.html,
      textbody: input.text,
      ...(attachments.length ? { attachments } : {}),
    };

    const serviceName = input.audit?.serviceName ?? 'email-send';
    const providerName = resolveEmailProviderName(this.config);

    const result = await this.vendorApi.request<unknown, ZeptomailSendBody>({
      providerName,
      serviceName,
      method: 'POST',
      absoluteUrl: apiUrl,
      headers: {
        Authorization: `Zoho-enczapikey ${token}`,
      },
      body,
      leadId: input.audit?.leadId ?? null,
      redactRequest: (payload) => ({
        from: payload?.from,
        to: payload?.to,
        subject: payload?.subject,
        htmlbody: payload?.htmlbody ? maskOtpInEmailBody(payload.htmlbody) : payload?.htmlbody,
        textbody: payload?.textbody ? maskOtpInEmailBody(payload.textbody) : payload?.textbody,
        attachments: payload?.attachments?.map((item) => ({
          name: item.name,
          mime_type: item.mime_type,
          content: '[base64 omitted]',
        })),
      }),
    });

    if (!result.ok) {
      const message =
        result.error?.message
        || (typeof result.body === 'object' && result.body && 'message' in (result.body as object)
          ? String((result.body as { message?: unknown }).message)
          : 'Zeptomail email API request failed');
      throw new Error(message);
    }

    return {
      configured: true,
      ok: true,
      httpStatus: result.httpStatus,
    };
  }
}

function guessMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}
