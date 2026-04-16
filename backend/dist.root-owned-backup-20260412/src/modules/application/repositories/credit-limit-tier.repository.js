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
exports.CreditLimitTierRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../prisma/prisma.service");
let CreditLimitTierRepository = class CreditLimitTierRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(session) {
        const client = session?.tx ?? this.prisma;
        return client.creditLimitTier.findMany({
            select: { id: true, minUnsecuredLoan: true, maxUnsecuredLoan: true, maxBulletLoan: true, sortOrder: true, isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
    }
    /** Returns the matching tier for a given unsecured credit limit, or undefined if below all tiers. */
    async findTierForLimit(unsecuredLimit, session) {
        const client = session?.tx ?? this.prisma;
        // Find the highest-ranked tier whose min is ≤ unsecuredLimit and whose max is either null or ≥ unsecuredLimit.
        const tier = await client.creditLimitTier.findFirst({
            where: {
                isActive: true,
                minUnsecuredLoan: { lte: unsecuredLimit },
                OR: [
                    { maxUnsecuredLoan: null },
                    { maxUnsecuredLoan: { gte: unsecuredLimit } },
                ],
            },
            select: { id: true, minUnsecuredLoan: true, maxUnsecuredLoan: true, maxBulletLoan: true, sortOrder: true, isActive: true },
            orderBy: { sortOrder: 'desc' }, // highest matching tier wins
        });
        return tier ?? undefined;
    }
    async updateById(id, data, session) {
        const client = session?.tx ?? this.prisma;
        return client.creditLimitTier.update({
            where: { id },
            data,
            select: { id: true, minUnsecuredLoan: true, maxUnsecuredLoan: true, maxBulletLoan: true, sortOrder: true, isActive: true },
        });
    }
};
exports.CreditLimitTierRepository = CreditLimitTierRepository;
exports.CreditLimitTierRepository = CreditLimitTierRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CreditLimitTierRepository);
