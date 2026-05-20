import {Injectable, Logger} from '@nestjs/common';
import {LOOKUP_CACHE_TTL_SECONDS} from '../../../../common/constants/app.constants';
import {
  readBureauFetchMode,
  type BureauFetchMode,
} from '../../../../common/constants/bureau-fetch-settings.util';
import {SettingKey} from '../../../../common/constants/setting.constants';
import {RedisService} from '../../../../common/redis/redis.service';
import {PrismaService} from '../../../../prisma/prisma.service';

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

export interface BreSettings {
  minAge: number;
  maxAge: number;
  rejectedGenderIds: number[];
  rejectedOccupationIds: number[];
}

export interface LoanCalculationSettings {
  minLoanAmount: number;
  maxLoanAmount: number;
  loanTenureDays: number;
  roiPerDayPercent: number;
  processingFeePercent: number;
  processingFeeGstPercent: number;
}

export interface CustomerLeadPolicySettings {
  reapplyAfterRejectedDays: number;
  blacklistRejectionThreshold: number;
  blacklistDurationDays: number;
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

function settingRedisKey(settingKey: string): string {
  return `setting:${settingKey}`;
}

/**
 * When an older compiled `setting.constants` is deployed with a newer
 * `settings.repository`, `SettingKey.NEW_ENTRY` can be undefined and
 * `undefined.key` crashes. Prefer live `SettingKey` when present.
 */
const BRE_SETTING_FALLBACK = {
  BRE_MIN_AGE: { key: 'BRE_MIN_AGE', default: '21' },
  BRE_MAX_AGE: { key: 'BRE_MAX_AGE', default: '57' },
  BRE_REJECTED_GENDERS: { key: 'BRE_REJECTED_GENDERS', default: '3' },
  BRE_REJECTED_OCCUPATIONS: { key: 'BRE_REJECTED_OCCUPATIONS', default: '4,5,6' },
} as const;

type BreSettingKeyId = keyof typeof BRE_SETTING_FALLBACK;

function breSettingMeta(id: BreSettingKeyId): { key: string; default: string } {
  const entry = SettingKey[id as keyof typeof SettingKey] as { key: string; default: string } | undefined;
  if (entry && typeof entry.key === 'string' && typeof entry.default === 'string') {
    return entry;
  }
  return BRE_SETTING_FALLBACK[id];
}

@Injectable()
export class SettingsRepository {
  private readonly logger = new Logger(SettingsRepository.name);
  private authOtpCache: { value: AuthOtpSettings; expiresAt: number } | null = null;
  private authOtpInflight: Promise<AuthOtpSettings> | null = null;
  private leadPolicyCache: { value: CustomerLeadPolicySettings; expiresAt: number } | null = null;
  private leadPolicyInflight: Promise<CustomerLeadPolicySettings> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Whether PAN NSDL verification should run. Redis first (`setting:PAN_VERIFICATION_ENABLED`),
   * then DB; on miss the DB value is written back to Redis with TTL.
   */
  async isPanVerificationEnabled(): Promise<boolean> {
    const meta = SettingKey.PAN_VERIFICATION_ENABLED;
    const redisKey = settingRedisKey(meta.key);

    /*
    try {
      const cached = await this.redis.client.get(redisKey);
      if (cached !== null) {
        return parseBool(cached, false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis read failed for ${redisKey} (falling back to DB): ${msg}`);
    }
    */

    const row = await this.prisma.client.setting.findFirst({
      where: { key: meta.key, isActive: true },
      select: { value: true },
    });
    const raw = row?.value?.trim() ?? meta.default;
    const enabled = parseBool(raw, false);

    /*
    try {
      await this.redis.client.set(redisKey, enabled ? '1' : '0', 'EX', LOOKUP_CACHE_TTL_SECONDS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis write failed for ${redisKey}: ${msg}`);
    }
    */

    return enabled;
  }

  /**
   * Whether to run the bureau flow after PAN (`1` live, `2` mock). `0` = off.
   * DB `setting` row `BUREAU_FETCH_ENABLED` (default `1`).
   */
  async isBureauFetchEnabled(): Promise<boolean> {
    const mode = await readBureauFetchMode(this.prisma.client);
    return mode === 1 || mode === 2;
  }

  /** `0` off, `1` live Tenacio, `2` mock (no HTTP). */
  async getBureauFetchMode(): Promise<BureauFetchMode> {
    return readBureauFetchMode(this.prisma.client);
  }

  async loadCustomerLeadPolicySettings(): Promise<CustomerLeadPolicySettings> {
    const ttl = authOtpCacheTtlMs();
    const now = Date.now();

    if (ttl > 0 && this.leadPolicyCache && this.leadPolicyCache.expiresAt > now) {
      return this.leadPolicyCache.value;
    }

    if (this.leadPolicyInflight) {
      return this.leadPolicyInflight;
    }

    this.leadPolicyInflight = this.fetchCustomerLeadPolicySettings()
      .then((value) => {
        if (ttl > 0) {
          this.leadPolicyCache = { value, expiresAt: Date.now() + ttl };
        } else {
          this.leadPolicyCache = null;
        }
        return value;
      })
      .finally(() => {
        this.leadPolicyInflight = null;
      });

    return this.leadPolicyInflight;
  }

  async getReapplyAfterRejectedDays(): Promise<number> {
    return (await this.loadCustomerLeadPolicySettings()).reapplyAfterRejectedDays;
  }

  async getBlacklistRejectionThreshold(): Promise<number> {
    return (await this.loadCustomerLeadPolicySettings()).blacklistRejectionThreshold;
  }

  async getBlacklistDurationDays(): Promise<number> {
    return (await this.loadCustomerLeadPolicySettings()).blacklistDurationDays;
  }

  private async fetchCustomerLeadPolicySettings(): Promise<CustomerLeadPolicySettings> {
    const metas = [
      SettingKey.REAPPLY_AFTER_REJECTED,
      SettingKey.BLACKLIST_REJECTION_THRESHOLD,
      SettingKey.BLACKLIST_DURATION_DAYS,
    ] as const;
    const rows = await this.prisma.client.setting.findMany({
      where: { key: { in: metas.map((m) => m.key) }, isActive: true },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const pickInt = (meta: { key: string; default: string }) => {
      const raw = map.get(meta.key)?.trim() ?? meta.default;
      return Number.parseInt(raw, 10) || Number.parseInt(meta.default, 10);
    };

    return {
      reapplyAfterRejectedDays: pickInt(SettingKey.REAPPLY_AFTER_REJECTED),
      blacklistRejectionThreshold: pickInt(SettingKey.BLACKLIST_REJECTION_THRESHOLD),
      blacklistDurationDays: pickInt(SettingKey.BLACKLIST_DURATION_DAYS),
    };
  }

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
    this.leadPolicyCache = null;
  }

  async loadBreSettings(): Promise<BreSettings> {
    const m = breSettingMeta;
    const breKeys = [
      m('BRE_MIN_AGE').key,
      m('BRE_MAX_AGE').key,
      m('BRE_REJECTED_GENDERS').key,
      m('BRE_REJECTED_OCCUPATIONS').key,
    ] as const;

    const rows = await this.prisma.client.setting.findMany({
      where: { key: { in: [...breKeys] }, isActive: true },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const pick = (key: string, def: string) => map.get(key)?.trim() || def;

    const parseIdList = (raw: string): number[] =>
      raw
        .split(',')
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n));

    return {
      minAge: Math.max(1, parseInt(pick(m('BRE_MIN_AGE').key, m('BRE_MIN_AGE').default), 10) || 21),
      maxAge: Math.max(1, parseInt(pick(m('BRE_MAX_AGE').key, m('BRE_MAX_AGE').default), 10) || 57),
      rejectedGenderIds: parseIdList(pick(m('BRE_REJECTED_GENDERS').key, m('BRE_REJECTED_GENDERS').default)),
      rejectedOccupationIds: parseIdList(pick(m('BRE_REJECTED_OCCUPATIONS').key, m('BRE_REJECTED_OCCUPATIONS').default)),
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
}
