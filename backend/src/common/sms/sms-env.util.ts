import type { ConfigService } from '@nestjs/config';

/** Resolve outbound SMS POST URL from env (supports legacy `SMS_URL`). */
export function resolveSmsApiUrl(config: ConfigService): string | null {
  return (
    config.get<string>('SMS_API_URL')?.trim()
    || config.get<string>('SMS_URL')?.trim()
    || null
  );
}

/** Audit provider label for `vendor_api_log.provider_name`. */
export function resolveSmsProviderName(config: ConfigService): string {
  return (
    config.get<string>('SMS_PROVIDER_NAME')?.trim()
    || config.get<string>('SMS_VENDOR')?.trim()
    || 'SmsGateway'
  );
}
