import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class LosLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNewLeads() {
    const leads = await this.prisma.$queryRaw<Array<{
      uuid: string;
      customerUuid: string;
      mobileNumber: string;
      email: string | null;
      statusCode: string;
      statusLabel: string;
      sourceName: string | null;
      sourceType: string | null;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>>`
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
}
