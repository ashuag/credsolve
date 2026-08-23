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
    const reports = await this.prisma.read.bureauReport.findMany({
      orderBy: { createdAt: 'desc' },
      // Uncapped listing: select only list columns (never `include` the parent row —
      // Prisma would pull `raw_payload` / full CIBIL JSON and stall this endpoint).
      select: {
        uuid: true,
        cibilScore: true,
        dummyFetched: true,
        createdAt: true,
        customer: { select: { uuid: true, mobileNumber: true } },
        lead: {
          select: {
            uuid: true,
            leadNumber: true,
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
      leadNumber: row.lead.leadNumber,
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
    const reports = await this.prisma.read.bureauReport.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        rawPayload: true,
        cibilScore: true,
        lead: { select: { leadNumber: true } },
      },
    });

    const rows = [
      ['Lead ID', ...CIBIL_ASSESSMENT_EXPORT_HEADERS],
      ...reports.map((report, index) => [
        report.lead.leadNumber,
        ...buildCibilAssessmentExportRow(report.rawPayload, index + 1, report.cibilScore),
      ]),
    ];
    return buildSimpleXlsxWorkbook(rows, 'Sheet1');
  }
}
