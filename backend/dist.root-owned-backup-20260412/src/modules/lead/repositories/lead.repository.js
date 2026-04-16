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
exports.LeadRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../prisma/prisma.service");
const otp_constants_1 = require("../../../common/constants/otp.constants");
let LeadRepository = class LeadRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findLatestStateByCustomerId(customerId, session) {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                customerId,
                isActive: true
            },
            orderBy: { createdAt: 'desc' },
            select: {
                uuid: true,
                email: true,
                leadStatus: {
                    select: { name: true }
                }
            }
        });
        return lead
            ? { uuid: lead.uuid, email: lead.email, leadStatus: lead.leadStatus.name }
            : undefined;
    }
    async findLatestStateByCustomerUuid(customerUuid, session) {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                isActive: true,
                customer: {
                    is: { uuid: customerUuid }
                }
            },
            orderBy: { createdAt: 'desc' },
            select: {
                uuid: true,
                email: true,
                leadStatus: {
                    select: { name: true }
                }
            }
        });
        return lead
            ? { uuid: lead.uuid, email: lead.email, leadStatus: lead.leadStatus.name }
            : undefined;
    }
    async findLatestUuidByMobileNumber(mobileNumber, session) {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                isActive: true,
                customer: {
                    is: { mobileNumber }
                }
            },
            orderBy: { createdAt: 'desc' },
            select: { uuid: true }
        });
        return lead?.uuid;
    }
    async findLatestStateByMobileNumber(mobileNumber, session) {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                isActive: true,
                customer: {
                    is: { mobileNumber }
                }
            },
            orderBy: { createdAt: 'desc' },
            select: {
                uuid: true,
                email: true,
                leadStatus: {
                    select: { name: true }
                }
            }
        });
        return lead
            ? { uuid: lead.uuid, email: lead.email, leadStatus: lead.leadStatus.name }
            : undefined;
    }
    async findOwnedUuid(leadUuid, customerUuid, session) {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                uuid: leadUuid,
                isActive: true,
                customer: {
                    is: { uuid: customerUuid }
                }
            },
            select: { uuid: true }
        });
        return lead?.uuid;
    }
    async findCustomerIdByLeadUuid(leadUuid, session) {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findUnique({
            where: { uuid: leadUuid },
            select: { customerId: true }
        });
        return lead?.customerId;
    }
    async findIdByLeadUuid(leadUuid, session) {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                uuid: leadUuid,
                isActive: true
            },
            select: { id: true }
        });
        return lead?.id;
    }
    async updateEmailByUuid(params, session) {
        const client = session?.tx ?? this.prisma;
        await client.lead.updateMany({
            where: { uuid: params.leadUuid },
            data: {
                email: params.email,
                ...(params.leadStatusId !== undefined ? { leadStatusId: params.leadStatusId } : {}),
                ...(params.emailVerificationType !== undefined ? { emailVerificationType: params.emailVerificationType } : {}),
                updatedAt: new Date()
            }
        });
    }
    async markLatestPendingEmailOtpVerifiedByEmail(email, verifiedAt, session) {
        const client = session?.tx ?? this.prisma;
        const normalizedEmail = email.trim().toLowerCase();
        const emailOtpType = await client.otpType.findFirst({
            where: {
                isActive: true,
                name: otp_constants_1.OTP_TYPE.EMAIL
            },
            select: { id: true }
        });
        if (!emailOtpType) {
            return;
        }
        const latestPendingRequest = await client.otpRequest.findFirst({
            where: {
                value: normalizedEmail,
                typeId: emailOtpType.id,
                verifiedAt: null
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
        });
        if (!latestPendingRequest) {
            return;
        }
        await client.otpRequest.update({
            where: { id: latestPendingRequest.id },
            data: { verifiedAt }
        });
    }
    async updateStatusByUuid(leadUuid, leadStatusId, session) {
        const client = session?.tx ?? this.prisma;
        await client.lead.updateMany({
            where: { uuid: leadUuid },
            data: {
                leadStatusId,
                updatedAt: new Date()
            }
        });
    }
    async create(params, session) {
        const client = session?.tx ?? this.prisma;
        const hasUtmParams = Boolean(params.utmParams?.utmSource
            || params.utmParams?.utmMedium
            || params.utmParams?.utmCampaign
            || params.utmParams?.utmTerm
            || params.utmParams?.utmContent);
        await client.lead.create({
            data: {
                uuid: params.uuid,
                customerId: params.customerId,
                leadStatusId: params.leadStatusId,
                ...(hasUtmParams
                    ? {
                        leadUtms: {
                            create: {
                                utmSource: params.utmParams?.utmSource ?? null,
                                utmMedium: params.utmParams?.utmMedium ?? null,
                                utmCampaign: params.utmParams?.utmCampaign ?? null,
                                utmTerm: params.utmParams?.utmTerm ?? null,
                                utmContent: params.utmParams?.utmContent ?? null
                            }
                        }
                    }
                    : {})
            }
        });
    }
};
exports.LeadRepository = LeadRepository;
exports.LeadRepository = LeadRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadRepository);
