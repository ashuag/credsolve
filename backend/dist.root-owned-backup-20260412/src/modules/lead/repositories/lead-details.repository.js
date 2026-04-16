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
exports.LeadDetailsRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../prisma/prisma.service");
let LeadDetailsRepository = class LeadDetailsRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findActiveGenderIdByName(name, session) {
        const client = session?.tx ?? this.prisma;
        const gender = await client.gender.findFirst({
            where: {
                isActive: true,
                name
            },
            select: { id: true }
        });
        return gender?.id ?? null;
    }
    async findActiveCityIdByName(name, session) {
        const client = session?.tx ?? this.prisma;
        const city = await client.city.findFirst({
            where: {
                isActive: true,
                name
            },
            select: { id: true }
        });
        return city?.id ?? null;
    }
    async findActiveOccupationIdByName(name, session) {
        const client = session?.tx ?? this.prisma;
        const occupation = await client.occupation.findFirst({
            where: {
                isActive: true,
                name
            },
            select: { id: true }
        });
        return occupation?.id ?? null;
    }
    async findPersonalDetailsByLeadId(leadId, session) {
        const client = session?.tx ?? this.prisma;
        const row = await client.leadDetail.findUnique({
            where: { leadId },
            select: { fullName: true, dateOfBirth: true },
        });
        return row ?? null;
    }
    async upsertPersonalDetails(params, session) {
        const client = session?.tx ?? this.prisma;
        await client.leadDetail.upsert({
            where: { leadId: params.leadId },
            update: {
                fullName: params.fullName,
                dateOfBirth: params.dateOfBirth,
                gender: {
                    connect: { id: params.genderId }
                }
            },
            create: {
                fullName: params.fullName,
                dateOfBirth: params.dateOfBirth,
                lead: {
                    connect: { id: params.leadId }
                },
                gender: {
                    connect: { id: params.genderId }
                }
            }
        });
    }
    async upsertProfessionalDetails(params, session) {
        const client = session?.tx ?? this.prisma;
        const netMonthlyIncome = params.monthlyIncome ? new client_1.Prisma.Decimal(params.monthlyIncome) : null;
        const annualTurnover = params.annualTurnover ? new client_1.Prisma.Decimal(params.annualTurnover) : null;
        const annualProfit = params.annualProfit ? new client_1.Prisma.Decimal(params.annualProfit) : null;
        await client.leadDetail.upsert({
            where: { leadId: params.leadId },
            update: {
                city: {
                    connect: { id: params.cityId }
                },
                pincode: params.pincode,
                occupation: {
                    connect: { id: params.occupationId }
                },
                netMonthlyIncome,
                annualTurnover,
                annualProfit,
                ...(params.cibilConsentAt !== undefined ? { cibilConsentAt: params.cibilConsentAt } : {})
            },
            create: {
                pincode: params.pincode,
                netMonthlyIncome,
                annualTurnover,
                annualProfit,
                ...(params.cibilConsentAt !== undefined ? { cibilConsentAt: params.cibilConsentAt } : {}),
                lead: {
                    connect: { id: params.leadId }
                },
                city: {
                    connect: { id: params.cityId }
                },
                occupation: {
                    connect: { id: params.occupationId }
                }
            }
        });
    }
    async upsertOnboardingDetails(params, session) {
        const client = session?.tx ?? this.prisma;
        const netMonthlyIncome = params.monthlyIncome ? new client_1.Prisma.Decimal(params.monthlyIncome) : null;
        const annualTurnover = params.annualTurnover ? new client_1.Prisma.Decimal(params.annualTurnover) : null;
        const annualProfit = params.annualProfit ? new client_1.Prisma.Decimal(params.annualProfit) : null;
        await client.leadDetail.upsert({
            where: { leadId: params.leadId },
            update: {
                fullName: params.fullName,
                dateOfBirth: params.dateOfBirth,
                gender: {
                    connect: { id: params.genderId }
                },
                city: {
                    connect: { id: params.cityId }
                },
                pincode: params.pincode,
                occupation: {
                    connect: { id: params.occupationId }
                },
                netMonthlyIncome,
                annualTurnover,
                annualProfit,
                cibilConsentAt: params.cibilConsentAt
            },
            create: {
                fullName: params.fullName,
                dateOfBirth: params.dateOfBirth,
                pincode: params.pincode,
                netMonthlyIncome,
                annualTurnover,
                annualProfit,
                cibilConsentAt: params.cibilConsentAt,
                lead: {
                    connect: { id: params.leadId }
                },
                gender: {
                    connect: { id: params.genderId }
                },
                city: {
                    connect: { id: params.cityId }
                },
                occupation: {
                    connect: { id: params.occupationId }
                }
            }
        });
    }
};
exports.LeadDetailsRepository = LeadDetailsRepository;
exports.LeadDetailsRepository = LeadDetailsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadDetailsRepository);
