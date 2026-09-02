import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import {
  buildCibilAssessmentExportRow,
  CIBIL_ASSESSMENT_EXPORT_HEADERS,
} from '../../../common/cibil/cibil-assessment-export';
import { buildSimpleXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';

const EXPORT_BATCH_SIZE = 25;

@Injectable()
export class LosBureauReportService {
  private readonly logger = new Logger(LosBureauReportService.name);

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
        leadDetails: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            fullName: true,
            panNumber: true,
            lead: {
              select: {
                uuid: true,
                leadNumber: true,
                applications: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { uuid: true, applicationNumber: true },
                },
              },
            },
          },
        },
        cibilCreditAssessment: { select: { category: true } },
      },
    });

    return reports.map((row) => {
      const attached = row.leadDetails[0] ?? null;
      const lead = attached?.lead ?? null;
      return {
        uuid: row.uuid,
        leadUuid: lead?.uuid ?? null,
        leadNumber: lead?.leadNumber ?? null,
        customerUuid: row.customer.uuid,
        applicationUuid: lead?.applications[0]?.uuid ?? null,
        applicationNumber: lead?.applications[0]?.applicationNumber ?? null,
        fullName: formatLosPersonName(attached?.fullName),
        mobileNumber: row.customer.mobileNumber,
        panNumber: attached?.panNumber?.trim().toUpperCase() || null,
        cibilScore: row.cibilScore,
        cibilCreditAssessmentCategory: row.cibilCreditAssessment?.category ?? null,
        dummyFetched: Boolean(row.dummyFetched),
        fetchedAt: row.createdAt.toISOString(),
      };
    });
  }

  /** Builds the "Credit Assessment data" workbook (raw per-report feature columns) for LOS Reports → Bureau Report. */
  async exportBureauReportsWorkbook(): Promise<Buffer> {
    const rows: SimpleXlsxCell[][] = [['Lead ID', ...CIBIL_ASSESSMENT_EXPORT_HEADERS]];
    let cursorId: bigint | undefined;
    let index = 0;

    // Batch so we never load every `raw_payload` CIBIL JSON into memory at once
    // (that query stalls, OOMs, and 500s the Next proxy after ~30s).
    for (;;) {
      const batch = await this.prisma.read.bureauReport.findMany({
        take: EXPORT_BATCH_SIZE,
        ...(cursorId != null ? { skip: 1, cursor: { id: cursorId } } : {}),
        orderBy: { id: 'desc' },
        select: {
          id: true,
          rawPayload: true,
          cibilScore: true,
          customer: { select: { mobileNumber: true } },
          leadDetails: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { lead: { select: { leadNumber: true } } },
          },
        },
      });
      if (batch.length === 0) break;

      for (const report of batch) {
        index += 1;
        let featureCells: SimpleXlsxCell[];
        try {
          featureCells = buildCibilAssessmentExportRow(report.rawPayload, index, report.cibilScore);
        } catch (err) {
          this.logger.warn(
            `Skipping malformed bureau payload in export (lead=${report.leadDetails[0]?.lead.leadNumber ?? 'n/a'}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          featureCells = CIBIL_ASSESSMENT_EXPORT_HEADERS.map(() => null);
        }
        rows.push([report.leadDetails[0]?.lead.leadNumber ?? '', ...featureCells]);
      }

      cursorId = batch[batch.length - 1]!.id;
      if (batch.length < EXPORT_BATCH_SIZE) break;
    }

    return buildSimpleXlsxWorkbook(rows, 'Sheet1');
  }
}
