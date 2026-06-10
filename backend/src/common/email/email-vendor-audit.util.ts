import type { ConfigService } from '@nestjs/config';

/** Audit provider label for `vendor_api_log.provider_name`. */
export function resolveEmailProviderName(config: ConfigService): string {
  return (
    config.get<string>('EMAIL_PROVIDER')?.trim()
    || config.get<string>('EMAIL_PROVIDER_NAME')?.trim()
    || 'SMTP'
  );
}

export function buildEmailSmtpAuditPath(host: string, port: number): string {
  return `smtp://${host}:${port}`;
}

/** Mask OTP-like digit runs in email body text before audit persistence. */
export function maskOtpInEmailBody(text: string): string {
  return text.replace(/\d{4,8}/g, (match) => `${match.slice(0, 2)}****`);
}

export function buildEmailAuditRequestPayload(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachmentCount?: number;
  attachmentNames?: string[];
}): Record<string, unknown> {
  return {
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: maskOtpInEmailBody(input.text),
    ...(input.html ? { html: maskOtpInEmailBody(input.html) } : {}),
    ...(input.attachmentCount != null ? { attachmentCount: input.attachmentCount } : {}),
    ...(input.attachmentNames?.length ? { attachmentNames: input.attachmentNames } : {}),
  };
}
