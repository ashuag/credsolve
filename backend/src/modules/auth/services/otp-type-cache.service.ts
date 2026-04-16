import { Logger, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { OTP_TYPE_CACHE_TTL_SECONDS } from '../../../common/constants/app.constants';
import { OTP_TYPE, type OtpType } from '../../../common/constants/otp.constants';
import { warnWithError } from '../../../common/logging/logger.utils';
import { OtpRepository } from '../repositories/otp.repository';

const OTP_TYPE_CACHE_KEY = 'auth:otp-type-values';
type OtpTypeRedisClient = ReturnType<typeof createClient>;
type CachedOtpType = {
  id: number;
  name: OtpType;
};

@Injectable()
export class OtpTypeCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(OtpTypeCacheService.name);
  private redisClient: OtpTypeRedisClient | null = null;
  private redisConnectionPromise: Promise<OtpTypeRedisClient | null> | null = null;

  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly configService: ConfigService
  ) {}

  async getOtpTypes(): Promise<OtpType[]> {
    return (await this.getActiveOtpTypes()).map((value) => value.name);
  }

  async getOtpTypeId(type: OtpType): Promise<number | null> {
    const otpType = (await this.getActiveOtpTypes()).find((value) => value.name === type);

    return otpType?.id ?? null;
  }

  async ensureOtpType(type: OtpType) {
    return (await this.getOtpTypeId(type)) !== null;
  }

  private async getActiveOtpTypes(): Promise<CachedOtpType[]> {
    const redisClient = await this.getRedisClient();

    if (redisClient) {
      try {
        const cached = await redisClient.get(OTP_TYPE_CACHE_KEY);
        const parsed = this.parseCachedValues(cached);

        if (parsed.length > 0) {
          return parsed;
        }
      } catch (error) {
        warnWithError(this.logger, 'Unable to read otp types from redis', error);
      }
    }

    const values = await this.loadOtpTypesFromDatabase();

    if (redisClient && values.length > 0) {
      try {
        await redisClient.set(OTP_TYPE_CACHE_KEY, JSON.stringify(values), { EX: OTP_TYPE_CACHE_TTL_SECONDS });
      } catch (error) {
        warnWithError(this.logger, 'Unable to cache otp types in redis', error);
      }
    }

    return values;
  }

  private async loadOtpTypesFromDatabase(): Promise<CachedOtpType[]> {
    const otpTypes = await this.otpRepository.findActiveTypes();

    return otpTypes
      .map((otpType) => {
        const name = this.toOtpType(otpType.name);

        if (!name) {
          return null;
        }

        return {
          id: otpType.id,
          name
        };
      })
      .filter((value): value is CachedOtpType => value !== null);
  }

  private parseCachedValues(cached: string | null): CachedOtpType[] {
    if (!cached) {
      return [];
    }

    try {
      const parsed = JSON.parse(cached) as unknown;

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((value): value is CachedOtpType => this.isCachedOtpType(value));
    } catch {
      return [];
    }
  }

  private isCachedOtpType(value: unknown): value is CachedOtpType {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as { id?: unknown; name?: unknown };

    return (
      Number.isInteger(candidate.id)
      && typeof candidate.name === 'string'
      && (Object.values(OTP_TYPE) as string[]).includes(candidate.name)
    );
  }

  private toOtpType(name: string): OtpType | null {
    const normalizedName = name.trim().toLowerCase();

    if (normalizedName === OTP_TYPE.MOBILE) {
      return OTP_TYPE.MOBILE;
    }

    if (normalizedName === OTP_TYPE.EMAIL) {
      return OTP_TYPE.EMAIL;
    }

    return null;
  }

  private async getRedisClient(): Promise<OtpTypeRedisClient | null> {
    if (this.redisClient?.isOpen) {
      return this.redisClient;
    }

    if (this.redisClient && !this.redisClient.isOpen) {
      this.redisClient = null;
    }

    if (!this.redisConnectionPromise) {
      const redisUrl = this.configService.get<string>('REDIS_URL')?.trim();

      if (!redisUrl) {
        return null;
      }

      this.redisConnectionPromise = this.connectRedis(redisUrl);
    }

    return this.redisConnectionPromise;
  }

  private async connectRedis(redisUrl: string): Promise<OtpTypeRedisClient | null> {
    const client = createClient({ url: redisUrl });

    client.on('error', (error) => {
      warnWithError(this.logger, 'Redis client error', error);
    });

    try {
      await client.connect();
      this.redisClient = client;
      return client;
    } catch (error) {
      warnWithError(this.logger, 'Unable to connect to redis', error);
      await client.disconnect().catch(() => undefined);
      return null;
    } finally {
      this.redisConnectionPromise = null;
    }
  }

  async onModuleDestroy() {
    if (this.redisClient?.isOpen) {
      await this.redisClient.quit().catch(() => undefined);
    }
  }
}
