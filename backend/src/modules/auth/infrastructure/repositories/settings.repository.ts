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

export interface LoanCalculationSettings {
  minLoanAmount: number;
  maxLoanAmount: number;
  loanTenureDays: number;
  roiPerDayPercent: number;
  processingFeePercent: number;
  processingFeeGstPercent: number;
}

/**
 * In-process TTL for cached auth/OTP settings. Override via env when running
 * pods that should pick up admin setting changes faster (e.g. set to 5_000 in
 * staging). Falls back to a 30s default which is long enough to flatten the
 * "every authenticated request reloads settings" hot path and short enough
 * that pods catch up on changes within a minute without explicit invalidation.
 */
function authOtpCacheTtlMs(): number {
  const raw = process.env.AUTH_OTP_SETTINGS_CACHE_TTL_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 600_000) return parsed;
  return 30_000;
}

@Injectable()
export class SettingsRepository {
  private authOtpCache: { value: AuthOtpSettings; expiresAt: number } | null = null;
  private authOtpInflight: Promise<AuthOtpSettings> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async loadAuthOtpSettings(): Promise<AuthOtpSettings> {
    const ttl = authOtpCacheTtlMs();
    const now = Date.now();

    if (ttl > 0 && this.authOtpCache && this.authOtpCache.expiresAt > now) {
      return this.authOtpCache.value;
    }

    // Coalesce concurrent reloads so a thundering herd of expired-cache
    // requests doesn't stampede the DB.
    if (this.authOtpInflight) {
      return this.authOtpInflight;
    }

    this.authOtpInflight = this.fetchAuthOtpSettings()
      .then((value) => {
        if (ttl > 0) {
          this.authOtpCache = { value, expiresAt: Date.now() + ttl };
        } else {
          this.authOtpCache = null;
        }
        return value;
      })
      .finally(() => {
        this.authOtpInflight = null;
      });

    return this.authOtpInflight;
  }

  /** Test/admin hook: clear the in-process auth/OTP settings cache. */
  invalidateAuthOtpSettingsCache(): void {
    this.authOtpCache = null;
  }

  private async fetchAuthOtpSettings(): Promise<AuthOtpSettings> {
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

  async loadLoanCalculationSettings(): Promise<LoanCalculationSettings> {
    const loanKeys = [
      SettingKey.MIN_LOAN_AMOUNT.key,
      SettingKey.MAX_LOAN_AMOUNT.key,
      SettingKey.LOAN_TENURE.key,
      SettingKey.ROI_PER_DAY.key,
      SettingKey.PROCESSING_FEE.key,
      SettingKey.PROCESSING_FEE_GST.key,
    ] as const;

    const rows = await this.prisma.client.setting.findMany({
      where: { key: { in: [...loanKeys] }, isActive: true },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const pick = (key: string, def: string) => map.get(key)?.trim() || def;

    const minLoanAmount = Math.max(
      1000,
      parseInt(pick(SettingKey.MIN_LOAN_AMOUNT.key, SettingKey.MIN_LOAN_AMOUNT.default), 10) || 5000
    );
    const maxLoanAmount = Math.max(
      minLoanAmount,
      parseInt(pick(SettingKey.MAX_LOAN_AMOUNT.key, SettingKey.MAX_LOAN_AMOUNT.default), 10) || 50000
    );
    const loanTenureDays = Math.min(
      62,
      Math.max(1, parseInt(pick(SettingKey.LOAN_TENURE.key, SettingKey.LOAN_TENURE.default), 10) || 30)
    );
    const roiPerDayPercent = Math.min(
      10,
      Math.max(0, parseFloat(pick(SettingKey.ROI_PER_DAY.key, SettingKey.ROI_PER_DAY.default)) || 1)
    );
    const processingFeePercent = Math.min(
      40,
      Math.max(0, parseFloat(pick(SettingKey.PROCESSING_FEE.key, SettingKey.PROCESSING_FEE.default)) || 0)
    );
    const processingFeeGstPercent = Math.min(
      40,
      Math.max(0, parseFloat(pick(SettingKey.PROCESSING_FEE_GST.key, SettingKey.PROCESSING_FEE_GST.default)) || 0)
    );

    return {
      minLoanAmount,
      maxLoanAmount,
      loanTenureDays,
      roiPerDayPercent,
      processingFeePercent,
      processingFeeGstPercent,
    };
  }
}
