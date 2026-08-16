import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import {
  buildCibilAssessmentExportRow,
  CIBIL_ASSESSMENT_EXPORT_HEADERS,
} from '../../../common/cibil/cibil-assessment-export';
import { buildSimpleXlsxWorkbook } from '../../../common/xlsx/simple-xlsx';

@Injectable()
export class LosBureauReportService {
  constructor(private readonly prisma: PrismaService) {}

  async listBureauReports() {
    const reports = await this.prisma.client.bureauReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        lead: {
          select: {
            uuid: true,
            leadDetail: { select: { fullName: true, panNumber: true } },
            applications: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { uuid: true, applicationNumber: true },
            },
          },
        },
        cibilCreditAssessment: { select: { category: true } },
      },
    });

    return reports.map((row) => ({
      uuid: row.uuid,
      leadUuid: row.lead.uuid,
      customerUuid: row.customer.uuid,
      applicationUuid: row.lead.applications[0]?.uuid ?? null,
      applicationNumber: row.lead.applications[0]?.applicationNumber ?? null,
      fullName: formatLosPersonName(row.lead.leadDetail?.fullName),
      mobileNumber: row.customer.mobileNumber,
      panNumber: row.lead.leadDetail?.panNumber?.trim().toUpperCase() || null,
      cibilScore: row.cibilScore,
      cibilCreditAssessmentCategory: row.cibilCreditAssessment?.category ?? null,
      dummyFetched: Boolean(row.dummyFetched),
      fetchedAt: row.createdAt.toISOString(),
    }));
  }

  /** Builds the "Credit Assessment data" workbook (raw per-report feature columns) for LOS Reports → Bureau Report. */
  async exportBureauReportsWorkbook(): Promise<Buffer> {
    const reports = await this.prisma.client.bureauReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { rawPayload: true, cibilScore: true },
    });

    const rows = [
      [...CIBIL_ASSESSMENT_EXPORT_HEADERS],
      ...reports.map((report, index) =>
        buildCibilAssessmentExportRow(report.rawPayload, index + 1, report.cibilScore),
      ),
    ];
    return buildSimpleXlsxWorkbook(rows, 'Sheet1');
  }
}
