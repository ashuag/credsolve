import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { LOOKUP_CACHE_TTL_SECONDS } from '../../common/constants/app.constants';
import { GENDER } from '../../common/constants/gender.constants';
import { OCCUPATION } from '../../common/constants/occupation.constants';
import { warnWithError } from '../../common/logging/logger.utils';
import { PrismaService } from '../../../prisma/prisma.service';

const GENDER_CACHE_KEY = 'lookups:gender:values';
const OCCUPATION_CACHE_KEY = 'lookups:occupation:values';
const CITY_CACHE_KEY = 'lookups:city:values';

type RedisClient = ReturnType<typeof createClient>;
type LookupValue = {
  id: number;
  name: string;
};

@Injectable()
export class LookupsService implements OnModuleDestroy {
  private readonly logger = new Logger(LookupsService.name);
  private redisClient: RedisClient | null = null;
  private redisConnectionPromise: Promise<RedisClient | null> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async getGenders() {
    return {
      values: await this.getLookupValues(
        GENDER_CACHE_KEY,
        async () => this.prisma.gender.findMany({
          where: { isActive: true },
          orderBy: { id: 'asc' },
          select: { id: true, name: true }
        }),
        Object.values(GENDER)
      )
    };
  }

  async getOccupations() {
    return {
      values: await this.getLookupValues(
        OCCUPATION_CACHE_KEY,
        async () => this.prisma.occupation.findMany({
          where: { isActive: true },
          orderBy: { id: 'asc' },
          select: { id: true, name: true }
        }),
        Object.values(OCCUPATION)
      )
    };
  }

  async getCities() {
    return {
      values: await this.getLookupValues(
        CITY_CACHE_KEY,
        async () => this.prisma.city.findMany({
          where: { isActive: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true }
        })
      )
    };
  }

  async invalidateGenderCache() {
    await this.invalidateLookupCache(GENDER_CACHE_KEY);
  }

  async invalidateOccupationCache() {
    await this.invalidateLookupCache(OCCUPATION_CACHE_KEY);
  }

  async invalidateCityCache() {
    await this.invalidateLookupCache(CITY_CACHE_KEY);
  }

  private async getLookupValues(
    cacheKey: string,
    loader: () => Promise<Array<{ id: number; name: string }>>,
    expectedOrder?: readonly string[]
  ): Promise<LookupValue[]> {
    const redisClient = await this.getRedisClient();

    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        const parsed = this.parseLookupValues(cached);

        if (parsed.length > 0) {
          return this.sortLookupValues(parsed, expectedOrder);
        }
      } catch (error) {
        warnWithError(this.logger, `Unable to read ${cacheKey} from redis`, error);
      }
    }

    const values = (await loader()).map((value) => ({
      id: value.id,
      name: value.name.trim()
    }));

    if (redisClient && values.length > 0) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(values), { EX: LOOKUP_CACHE_TTL_SECONDS });
      } catch (error) {
        warnWithError(this.logger, `Unable to cache ${cacheKey} in redis`, error);
      }
    }

    return this.sortLookupValues(values, expectedOrder);
  }

  private async invalidateLookupCache(cacheKey: string) {
    const redisClient = await this.getRedisClient();

    if (!redisClient) {
      return;
    }

    try {
      await redisClient.del(cacheKey);
    } catch (error) {
      warnWithError(this.logger, `Unable to invalidate ${cacheKey} in redis`, error);
    }
  }

  private parseLookupValues(cached: string | null): LookupValue[] {
    if (!cached) {
      return [];
    }

    try {
      const parsed = JSON.parse(cached) as unknown;

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((value): value is { id: number; name: string } => (
          typeof value === 'object'
          && value !== null
          && typeof (value as { id?: unknown }).id === 'number'
          && typeof (value as { name?: unknown }).name === 'string'
        ))
        .map((value) => ({
          id: value.id,
          name: value.name.trim()
        }));
    } catch {
      return [];
    }
  }

  private sortLookupValues(values: LookupValue[], expectedOrder?: readonly string[]) {
    if (!expectedOrder || expectedOrder.length === 0) {
      return [...values].sort((left, right) => left.name.localeCompare(right.name));
    }

    const orderMap = new Map(expectedOrder.map((value, index) => [value.toLowerCase(), index]));

    return [...values].sort((left, right) => {
      const leftOrder = orderMap.get(left.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderMap.get(right.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private async getRedisClient(): Promise<RedisClient | null> {
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

  private async connectRedis(redisUrl: string): Promise<RedisClient | null> {
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
