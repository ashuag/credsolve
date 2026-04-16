"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LookupsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LookupsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_1 = require("redis");
const app_constants_1 = require("../../common/constants/app.constants");
const gender_constants_1 = require("../../common/constants/gender.constants");
const occupation_constants_1 = require("../../common/constants/occupation.constants");
const logger_utils_1 = require("../../common/logging/logger.utils");
const prisma_service_1 = require("../../../prisma/prisma.service");
const GENDER_CACHE_KEY = 'lookups:gender:values';
const OCCUPATION_CACHE_KEY = 'lookups:occupation:values';
const CITY_CACHE_KEY = 'lookups:city:values';
let LookupsService = LookupsService_1 = class LookupsService {
    prisma;
    configService;
    logger = new common_1.Logger(LookupsService_1.name);
    redisClient = null;
    redisConnectionPromise = null;
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async getGenders() {
        return {
            values: await this.getLookupValues(GENDER_CACHE_KEY, async () => this.prisma.gender.findMany({
                where: { isActive: true },
                orderBy: { id: 'asc' },
                select: { id: true, name: true }
            }), Object.values(gender_constants_1.GENDER))
        };
    }
    async getOccupations() {
        return {
            values: await this.getLookupValues(OCCUPATION_CACHE_KEY, async () => this.prisma.occupation.findMany({
                where: { isActive: true },
                orderBy: { id: 'asc' },
                select: { id: true, name: true }
            }), Object.values(occupation_constants_1.OCCUPATION))
        };
    }
    async getCities() {
        return {
            values: await this.getLookupValues(CITY_CACHE_KEY, async () => this.prisma.city.findMany({
                where: { isActive: true },
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                select: { id: true, name: true }
            }))
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
    async getLookupValues(cacheKey, loader, expectedOrder) {
        const redisClient = await this.getRedisClient();
        if (redisClient) {
            try {
                const cached = await redisClient.get(cacheKey);
                const parsed = this.parseLookupValues(cached);
                if (parsed.length > 0) {
                    return this.sortLookupValues(parsed, expectedOrder);
                }
            }
            catch (error) {
                (0, logger_utils_1.warnWithError)(this.logger, `Unable to read ${cacheKey} from redis`, error);
            }
        }
        const values = (await loader()).map((value) => ({
            id: value.id,
            name: value.name.trim()
        }));
        if (redisClient && values.length > 0) {
            try {
                await redisClient.set(cacheKey, JSON.stringify(values), { EX: app_constants_1.LOOKUP_CACHE_TTL_SECONDS });
            }
            catch (error) {
                (0, logger_utils_1.warnWithError)(this.logger, `Unable to cache ${cacheKey} in redis`, error);
            }
        }
        return this.sortLookupValues(values, expectedOrder);
    }
    async invalidateLookupCache(cacheKey) {
        const redisClient = await this.getRedisClient();
        if (!redisClient) {
            return;
        }
        try {
            await redisClient.del(cacheKey);
        }
        catch (error) {
            (0, logger_utils_1.warnWithError)(this.logger, `Unable to invalidate ${cacheKey} in redis`, error);
        }
    }
    parseLookupValues(cached) {
        if (!cached) {
            return [];
        }
        try {
            const parsed = JSON.parse(cached);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .filter((value) => (typeof value === 'object'
                && value !== null
                && typeof value.id === 'number'
                && typeof value.name === 'string'))
                .map((value) => ({
                id: value.id,
                name: value.name.trim()
            }));
        }
        catch {
            return [];
        }
    }
    sortLookupValues(values, expectedOrder) {
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
    async getRedisClient() {
        if (this.redisClient?.isOpen) {
            return this.redisClient;
        }
        if (this.redisClient && !this.redisClient.isOpen) {
            this.redisClient = null;
        }
        if (!this.redisConnectionPromise) {
            const redisUrl = this.configService.get('REDIS_URL')?.trim();
            if (!redisUrl) {
                return null;
            }
            this.redisConnectionPromise = this.connectRedis(redisUrl);
        }
        return this.redisConnectionPromise;
    }
    async connectRedis(redisUrl) {
        const client = (0, redis_1.createClient)({ url: redisUrl });
        client.on('error', (error) => {
            (0, logger_utils_1.warnWithError)(this.logger, 'Redis client error', error);
        });
        try {
            await client.connect();
            this.redisClient = client;
            return client;
        }
        catch (error) {
            (0, logger_utils_1.warnWithError)(this.logger, 'Unable to connect to redis', error);
            await client.disconnect().catch(() => undefined);
            return null;
        }
        finally {
            this.redisConnectionPromise = null;
        }
    }
    async onModuleDestroy() {
        if (this.redisClient?.isOpen) {
            await this.redisClient.quit().catch(() => undefined);
        }
    }
};
exports.LookupsService = LookupsService;
exports.LookupsService = LookupsService = LookupsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], LookupsService);
