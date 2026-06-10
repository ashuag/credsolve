import type { ConfigService } from '@nestjs/config';

export type ResolvedEmailFromConfig = {
  fromAddress: string;
  fromName: string;
  provider: string | null;
};

export type ResolvedEmailTransportConfig = ResolvedEmailFromConfig & {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string;
};

/** Zeptomail and legacy SMTP share `EMAIL_PASSOWRD` (typo preserved) or `EMAIL_PASSWORD`. */
export function resolveEmailPassword(config: ConfigService): string {
  return (
    config.get<string>('EMAIL_PASSOWRD')
    ?? config.get<string>('EMAIL_PASSWORD')
    ?? config.get<string>('SMTP_PASS')
    ?? ''
  );
}

export function resolveEmailFromConfig(config: ConfigService): ResolvedEmailFromConfig | null {
  const fromAddress =
    config.get<string>('EMAIL_FROM')?.trim()
    || config.get<string>('MAIL_FROM_ADDRESS')?.trim()
    || config.get<string>('EMAIL_USER_NAME')?.trim()
    || config.get<string>('SMTP_USER')?.trim()
    || '';
  if (!fromAddress) return null;

  return {
    fromAddress,
    fromName: config.get<string>('MAIL_FROM_NAME')?.trim() || 'MoneyCash',
    provider: config.get<string>('EMAIL_PROVIDER')?.trim() || null,
  };
}

/** Zeptomail REST send-mail endpoint (India default). Override with `EMAIL_API_URL`. */
export function resolveZeptomailApiUrl(config: ConfigService): string {
  const explicit = config.get<string>('EMAIL_API_URL')?.trim();
  if (explicit) return explicit;

  const version = config.get<string>('EMAIL_API_VERSION')?.trim() || 'v1.1';
  const apiHost = config.get<string>('EMAIL_API_HOST')?.trim() || 'api.zeptomail.in';
  return `https://${apiHost}/${version}/email`;
}

export function shouldUseZeptomailEmailApi(config: ConfigService): boolean {
  const provider = config.get<string>('EMAIL_PROVIDER')?.trim().toLowerCase();
  const token = resolveEmailPassword(config);
  if (!token) return false;
  if (provider === 'zeptomail') return true;
  return Boolean(config.get<string>('EMAIL_API_URL')?.trim() || config.get<string>('EMAIL_API_HOST')?.trim());
}

export function isEmailConfigured(config: ConfigService): boolean {
  return shouldUseZeptomailEmailApi(config) || resolveEmailTransportConfig(config) !== null;
}

/** Outbound SMTP host (`EMAIL_HOST` preferred, legacy `SMTP_HOST` fallback). */
export function resolveEmailHost(config: ConfigService): string | null {
  return config.get<string>('EMAIL_HOST')?.trim() || config.get<string>('SMTP_HOST')?.trim() || null;
}

export function resolveEmailTransportConfig(config: ConfigService): ResolvedEmailTransportConfig | null {
  const host = resolveEmailHost(config);
  if (!host) return null;

  const from = resolveEmailFromConfig(config);
  if (!from) return null;

  const emailHost = config.get<string>('EMAIL_HOST')?.trim();

  if (emailHost) {
    const port = Number.parseInt(config.get<string>('EMAIL_PORT') ?? '587', 10) || 587;
    const secure =
      config.get<string>('EMAIL_SECURE')?.trim().toLowerCase() === 'true' || port === 465;
    const user = config.get<string>('EMAIL_USER_NAME')?.trim() || null;
    const pass = resolveEmailPassword(config);

    return { host, port, secure, user, pass, ...from };
  }

  const port = Number.parseInt(config.get<string>('SMTP_PORT') ?? '587', 10) || 587;
  const secure =
    config.get<string>('EMAIL_SECURE')?.trim().toLowerCase() === 'true' || port === 465;
  const user = config.get<string>('SMTP_USER')?.trim() || null;
  const pass = resolveEmailPassword(config);

  return { host, port, secure, user, pass, ...from };
}
