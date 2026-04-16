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
var OtpTypeCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpTypeCacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_1 = require("redis");
const app_constants_1 = require("../../../common/constants/app.constants");
const otp_constants_1 = require("../../../common/constants/otp.constants");
const logger_utils_1 = require("../../../common/logging/logger.utils");
const otp_repository_1 = require("../repositories/otp.repository");
const OTP_TYPE_CACHE_KEY = 'auth:otp-type-values';
let OtpTypeCacheService = OtpTypeCacheService_1 = class OtpTypeCacheService {
    otpRepository;
    configService;
    logger = new common_1.Logger(OtpTypeCacheService_1.name);
    redisClient = null;
    redisConnectionPromise = null;
    constructor(otpRepository, configService) {
        this.otpRepository = otpRepository;
        this.configService = configService;
    }
    async getOtpTypes() {
        return (await this.getActiveOtpTypes()).map((value) => value.name);
    }
    async getOtpTypeId(type) {
        const otpType = (await this.getActiveOtpTypes()).find((value) => value.name === type);
        return otpType?.id ?? null;
    }
    async ensureOtpType(type) {
        return (await this.getOtpTypeId(type)) !== null;
    }
    async getActiveOtpTypes() {
        const redisClient = await this.getRedisClient();
        if (redisClient) {
            try {
                const cached = await redisClient.get(OTP_TYPE_CACHE_KEY);
                const parsed = this.parseCachedValues(cached);
                if (parsed.length > 0) {
                    return parsed;
                }
            }
            catch (error) {
                (0, logger_utils_1.warnWithError)(this.logger, 'Unable to read otp types from redis', error);
            }
        }
        const values = await this.loadOtpTypesFromDatabase();
        if (redisClient && values.length > 0) {
            try {
                await redisClient.set(OTP_TYPE_CACHE_KEY, JSON.stringify(values), { EX: app_constants_1.OTP_TYPE_CACHE_TTL_SECONDS });
            }
            catch (error) {
                (0, logger_utils_1.warnWithError)(this.logger, 'Unable to cache otp types in redis', error);
            }
        }
        return values;
    }
    async loadOtpTypesFromDatabase() {
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
            .filter((value) => value !== null);
    }
    parseCachedValues(cached) {
        if (!cached) {
            return [];
        }
        try {
            const parsed = JSON.parse(cached);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.filter((value) => this.isCachedOtpType(value));
        }
        catch {
            return [];
        }
    }
    isCachedOtpType(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const candidate = value;
        return (Number.isInteger(candidate.id)
            && typeof candidate.name === 'string'
            && Object.values(otp_constants_1.OTP_TYPE).includes(candidate.name));
    }
    toOtpType(name) {
        const normalizedName = name.trim().toLowerCase();
        if (normalizedName === otp_constants_1.OTP_TYPE.MOBILE) {
            return otp_constants_1.OTP_TYPE.MOBILE;
        }
        if (normalizedName === otp_constants_1.OTP_TYPE.EMAIL) {
            return otp_constants_1.OTP_TYPE.EMAIL;
        }
        return null;
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
exports.OtpTypeCacheService = OtpTypeCacheService;
exports.OtpTypeCacheService = OtpTypeCacheService = OtpTypeCacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [otp_repository_1.OtpRepository,
        config_1.ConfigService])
], OtpTypeCacheService);
