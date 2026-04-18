import { Injectable } from '@nestjs/common';
import { SettingKey } from '../../../../common/constants/setting.constants';
import { PrismaService } from '../../../../prisma/prisma.service';

const KEYS = [
  SettingKey.OTP_EXPIRE_DURATION.key,
  SettingKey.OTP_MAX_ATTEMPTS.key,
  SettingKey.OTP_RESEND_COOLDOWN.key,
  SettingKey.OTP_LENGTH.key,
  SettingKey.LEAD_EXPIRE_DAYS.key,
  SettingKey.CUSTOMER_AUTH_COOKIE_NAME.key,
  SettingKey.CUSTOMER_SESSION_TTL_MS.key,
  SettingKey.CUSTOMER_SESSION_SLIDING.key,
  SettingKey.CUSTOMER_SESSION_ROTATE_ON_USE.key,
] as const;

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback;
  const t = raw.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes' || t === 'on';
}

export interface AuthOtpSettings {
  otpExpireSeconds: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpLength: number;
  leadExpireDays: number;
  authCookieName: string;
  /** Session TTL for Redis + cookie max-age (ms). */
  sessionTtlMs: number;
  sessionSliding: boolean;
  sessionRotateOnUse: boolean;
}

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadAuthOtpSettings(): Promise<AuthOtpSettings> {
    const rows = await this.prisma.client.setting.findMany({
      where: { key: { in: [...KEYS] }, isActive: true },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const pick = (key: string, def: string) => map.get(key)?.trim() || def;

    const otpExpireSeconds = Math.max(
      30,
      parseInt(pick(SettingKey.OTP_EXPIRE_DURATION.key, SettingKey.OTP_EXPIRE_DURATION.default), 10) || 120
    );
    const otpMaxAttempts = Math.max(
      1,
      parseInt(pick(SettingKey.OTP_MAX_ATTEMPTS.key, SettingKey.OTP_MAX_ATTEMPTS.default), 10) || 3
    );
    const otpResendCooldownSeconds = Math.max(
      5,
      parseInt(pick(SettingKey.OTP_RESEND_COOLDOWN.key, SettingKey.OTP_RESEND_COOLDOWN.default), 10) || 30
    );
    const otpLength = Math.min(8, Math.max(4, parseInt(pick(SettingKey.OTP_LENGTH.key, SettingKey.OTP_LENGTH.default), 10) || 6));
    const leadExpireDays = Math.max(
      1,
      parseInt(pick(SettingKey.LEAD_EXPIRE_DAYS.key, SettingKey.LEAD_EXPIRE_DAYS.default), 10) || 90
    );
    const authCookieName =
      pick(SettingKey.CUSTOMER_AUTH_COOKIE_NAME.key, SettingKey.CUSTOMER_AUTH_COOKIE_NAME.default) || 'mc_sid';
    const rawTtl = parseInt(
      pick(SettingKey.CUSTOMER_SESSION_TTL_MS.key, SettingKey.CUSTOMER_SESSION_TTL_MS.default),
      10
    );
    const sessionTtlMs =
      Number.isFinite(rawTtl) && rawTtl >= 60_000 && rawTtl <= 86_400_000 ? rawTtl : 900_000;
    const sessionSliding = parseBool(
      pick(SettingKey.CUSTOMER_SESSION_SLIDING.key, SettingKey.CUSTOMER_SESSION_SLIDING.default),
      true
    );
    const sessionRotateOnUse = parseBool(
      pick(SettingKey.CUSTOMER_SESSION_ROTATE_ON_USE.key, SettingKey.CUSTOMER_SESSION_ROTATE_ON_USE.default),
      false
    );

    return {
      otpExpireSeconds,
      otpMaxAttempts,
      otpResendCooldownSeconds,
      otpLength,
      leadExpireDays,
      authCookieName,
      sessionTtlMs,
      sessionSliding,
      sessionRotateOnUse,
    };
  }
}
