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
exports.LosApplicationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../prisma/prisma.service");
let LosApplicationsService = class LosApplicationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getApplications() {
        const applications = await this.prisma.$queryRaw `
      SELECT
        a.\`uuid\` AS uuid,
        c.\`uuid\` AS customerUuid,
        l.\`uuid\` AS leadUuid,
        c.\`mobile_number\` AS mobileNumber,
        l.\`email\` AS email,
        ld.\`full_name\` AS fullName,
        ad.\`loan_amount\` AS loanAmount,
        aps.\`name\` AS statusCode,
        COALESCE(NULLIF(aps.\`display_name\`, ''), aps.\`name\`) AS statusLabel,
        a.\`created_at\` AS createdAt,
        a.\`updated_at\` AS updatedAt
      FROM \`application\` a
      INNER JOIN \`customer\` c ON c.\`id\` = a.\`customer_id\`
      LEFT JOIN \`lead\` l ON l.\`id\` = a.\`lead_id\`
      INNER JOIN \`application_status\` aps ON aps.\`id\` = a.\`application_status_id\`
      LEFT JOIN \`lead_detail\` ld ON ld.\`lead_id\` = a.\`lead_id\`
      LEFT JOIN \`application_details\` ad ON ad.\`application_id\` = a.\`id\`
      WHERE aps.\`is_active\` = 1
      ORDER BY a.\`created_at\` DESC
    `;
        return applications.map((application) => ({
            uuid: application.uuid,
            customerUuid: application.customerUuid,
            leadUuid: application.leadUuid,
            mobileNumber: application.mobileNumber,
            email: application.email,
            fullName: application.fullName,
            loanAmount: application.loanAmount === null ? null : application.loanAmount.toString(),
            statusCode: application.statusCode,
            statusLabel: application.statusLabel,
            createdAt: application.createdAt.toISOString(),
            updatedAt: application.updatedAt.toISOString(),
        }));
    }
};
exports.LosApplicationsService = LosApplicationsService;
exports.LosApplicationsService = LosApplicationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LosApplicationsService);
