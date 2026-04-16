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
exports.ApplicationRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../prisma/prisma.service");
let ApplicationRepository = class ApplicationRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findUuidByLeadUuid(leadUuid, session) {
        const client = session?.tx ?? this.prisma;
        const row = await client.application.findFirst({
            where: {
                lead: {
                    uuid: leadUuid
                }
            },
            select: { uuid: true }
        });
        return row?.uuid;
    }
    async findByLeadUuid(leadUuid, session) {
        const client = session?.tx ?? this.prisma;
        const row = await client.application.findFirst({
            where: {
                lead: {
                    uuid: leadUuid
                }
            },
            select: {
                id: true,
                uuid: true
            }
        });
        return row ?? undefined;
    }
    async updateStatusById(id, statusId, session) {
        const client = session?.tx ?? this.prisma;
        await client.application.update({
            where: { id },
            data: { applicationStatusId: statusId }
        });
    }
    async create(params, session) {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findUnique({
            where: { uuid: params.leadUuid },
            select: { id: true }
        });
        if (!lead) {
            return;
        }
        await client.application.create({
            data: {
                uuid: params.uuid,
                customerId: params.customerId,
                leadId: lead.id,
                applicationStatusId: params.statusId
            }
        });
    }
};
exports.ApplicationRepository = ApplicationRepository;
exports.ApplicationRepository = ApplicationRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ApplicationRepository);
