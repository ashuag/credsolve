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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../prisma/prisma.service");
let OtpRepository = class OtpRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findActiveTypes(session) {
        const client = session?.tx ?? this.prisma;
        return client.otpType.findMany({
            where: { isActive: true },
            orderBy: { id: 'asc' },
            select: {
                id: true,
                name: true
            }
        });
    }
    async getRecentRequestWindowStats(params, session) {
        const client = session?.tx ?? this.prisma;
        const aggregate = await client.otpRequest.aggregate({
            where: {
                value: params.value,
                typeId: params.typeId,
                ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
                createdAt: { gte: params.windowStart }
            },
            _count: { _all: true },
            _min: { createdAt: true }
        });
        return {
            count: aggregate._count._all,
            oldestAt: aggregate._min.createdAt ?? undefined
        };
    }
    async findLatestActiveRequest(params, session) {
        const client = session?.tx ?? this.prisma;
        const otpRequest = await client.otpRequest.findFirst({
            where: {
                value: params.value,
                typeId: params.typeId,
                verifiedAt: null,
                expiresAt: { gt: params.now }
            },
            orderBy: { createdAt: 'desc' },
            select: {
                lastSentAt: true
            }
        });
        return otpRequest ?? undefined;
    }
    async createOtpRequest(params, session) {
        const client = session?.tx ?? this.prisma;
        return client.otpRequest.create({
            data: {
                value: params.value,
                typeId: params.typeId,
                otpCode: params.otpCode,
                expiresAt: params.expiresAt,
                ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
                ...(params.utmParams?.utmSource ? { utmSource: params.utmParams.utmSource } : {}),
                ...(params.utmParams?.utmMedium ? { utmMedium: params.utmParams.utmMedium } : {}),
                ...(params.utmParams?.utmCampaign ? { utmCampaign: params.utmParams.utmCampaign } : {}),
                ...(params.utmParams?.utmTerm ? { utmTerm: params.utmParams.utmTerm } : {}),
                ...(params.utmParams?.utmContent ? { utmContent: params.utmParams.utmContent } : {})
            },
            select: {
                id: true,
                uuid: true,
            }
        });
    }
    async findRequestForVerification(params, session) {
        const client = session?.tx ?? this.prisma;
        return client.otpRequest.findFirst({
            where: {
                uuid: params.requestId
            },
            select: {
                id: true,
                uuid: true,
                value: true,
                otpCode: true,
                expiresAt: true,
                attemptCount: true,
                verifiedAt: true,
                utmSource: true,
                utmMedium: true,
                utmCampaign: true,
                utmTerm: true,
                utmContent: true
            }
        });
    }
    async updateAttemptCount(requestId, attemptCount, session) {
        const client = session?.tx ?? this.prisma;
        await client.otpRequest.update({
            where: { id: requestId },
            data: { attemptCount }
        });
    }
    async markVerified(requestId, verifiedAt, session) {
        const client = session?.tx ?? this.prisma;
        return client.otpRequest.update({
            where: { id: requestId },
            data: { verifiedAt },
            select: {
                id: true,
                uuid: true,
                verifiedAt: true
            }
        });
    }
    async deletePendingRequest(requestId, session) {
        const client = session?.tx ?? this.prisma;
        await client.otpRequest.deleteMany({
            where: {
                id: requestId,
                verifiedAt: null
            }
        });
    }
};
exports.OtpRepository = OtpRepository;
exports.OtpRepository = OtpRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OtpRepository);
