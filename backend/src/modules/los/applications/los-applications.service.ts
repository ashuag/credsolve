import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class LosApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getApplications() {
    const applications = await this.prisma.$queryRaw<Array<{
      uuid: string;
      customerUuid: string;
      leadUuid: string | null;
      mobileNumber: string;
      email: string | null;
      fullName: string | null;
      loanAmount: { toString(): string } | string | number | null;
      statusCode: string;
      statusLabel: string;
      createdAt: Date;
      updatedAt: Date;
    }>>`
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
}
