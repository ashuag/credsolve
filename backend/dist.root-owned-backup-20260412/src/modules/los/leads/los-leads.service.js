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
exports.LosLeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../prisma/prisma.service");
let LosLeadsService = class LosLeadsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getNewLeads() {
        const leads = await this.prisma.$queryRaw `
      SELECT
        l.\`uuid\` AS uuid,
        c.\`uuid\` AS customerUuid,
        c.\`mobile_number\` AS mobileNumber,
        l.\`email\` AS email,
        ls.\`name\` AS statusCode,
        COALESCE(NULLIF(ls.\`display_name\`, ''), ls.\`name\`) AS statusLabel,
        src.\`name\` AS sourceName,
        src.\`type\` AS sourceType,
        lu.\`utmSource\` AS utmSource,
        lu.\`utmMedium\` AS utmMedium,
        lu.\`utmCampaign\` AS utmCampaign,
        l.\`created_at\` AS createdAt,
        l.\`updated_at\` AS updatedAt
      FROM \`lead\` l
      INNER JOIN \`customer\` c ON c.\`id\` = l.\`customer_id\`
      INNER JOIN \`lead_status\` ls ON ls.\`id\` = l.\`lead_status_id\`
      LEFT JOIN \`lead_source\` src ON src.\`id\` = l.\`source_id\`
      LEFT JOIN (
        SELECT
          latest_lu.\`lead_id\` AS leadId,
          latest_lu.\`utm_source\` AS utmSource,
          latest_lu.\`utm_medium\` AS utmMedium,
          latest_lu.\`utm_campaign\` AS utmCampaign
        FROM \`lead_utm\` latest_lu
        INNER JOIN (
          SELECT \`lead_id\`, MAX(\`id\`) AS latestId
          FROM \`lead_utm\`
          GROUP BY \`lead_id\`
        ) latest ON latest.\`latestId\` = latest_lu.\`id\`
      ) lu ON lu.\`leadId\` = l.\`id\`
      WHERE l.\`is_active\` = 1
        AND ls.\`is_active\` = 1
      ORDER BY l.\`created_at\` DESC
    `;
        return leads.map((lead) => ({
            uuid: lead.uuid,
            customerUuid: lead.customerUuid,
            mobileNumber: lead.mobileNumber,
            email: lead.email,
            statusCode: lead.statusCode,
            statusLabel: lead.statusLabel,
            sourceName: lead.sourceName,
            sourceType: lead.sourceType,
            utmSource: lead.utmSource,
            utmMedium: lead.utmMedium,
            utmCampaign: lead.utmCampaign,
            createdAt: lead.createdAt.toISOString(),
            updatedAt: lead.updatedAt.toISOString(),
        }));
    }
};
exports.LosLeadsService = LosLeadsService;
exports.LosLeadsService = LosLeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LosLeadsService);
