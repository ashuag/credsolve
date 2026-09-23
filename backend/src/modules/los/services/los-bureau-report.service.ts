import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import {
  buildCibilAssessmentExportRow,
  CIBIL_ASSESSMENT_EXPORT_HEADERS,
} from '../../../common/cibil/cibil-assessment-export';
import { buildSimpleXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';
import {
  parseExportDatetimeRange,
  parseExportNumberRange,
  requireAtLeastOneExportFilter,
} from '../../../common/xlsx/export-row-filter.util';
import { CIBIL_CATEGORY_SET, type CibilCategory } from '../../../common/cibil/cibil-credit-assessment.engine';
import type { ExportBureauReportsQueryDto } from '../los-data.controller';

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

  /**
   * Builds the "Credit Assessment data" workbook (raw per-report feature columns) for LOS Reports
   * → Bureau Report. Mirrors the LOS Bureau Report table's own column filters (same field names as
   * the table's column keys) as a Prisma `where`, pushed into the same batched cursor query used to
   * avoid loading every `raw_payload` CIBIL JSON at once. Requires at least one filter, same as the
   * download button staying disabled until a filter matches at least one report.
   */
  async exportBureauReportsWorkbook(query: ExportBureauReportsQueryDto): Promise<Buffer> {
    requireAtLeastOneExportFilter(
      Object.values(query),
      'Apply at least one filter before downloading the bureau report dump.',
    );
    const where = this.buildExportWhere(query);
    const rows: SimpleXlsxCell[][] = [['Lead ID', ...CIBIL_ASSESSMENT_EXPORT_HEADERS]];
    let cursorId: bigint | undefined;
    let index = 0;

    // Batch so we never load every `raw_payload` CIBIL JSON into memory at once
    // (that query stalls, OOMs, and 500s the Next proxy after ~30s).
    for (;;) {
      const batch = await this.prisma.read.bureauReport.findMany({
        take: EXPORT_BATCH_SIZE,
        ...(cursorId != null ? { skip: 1, cursor: { id: cursorId } } : {}),
        where,
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

  /** Builds the export's Prisma `where` from the LOS Bureau Report table's own filters. Throws when none are set. */
  private buildExportWhere(query: ExportBureauReportsQueryDto): Prisma.BureauReportWhereInput {
    const and: Prisma.BureauReportWhereInput[] = [];

    const leadText = query.lead?.trim();
    if (leadText) {
      and.push({ leadDetails: { some: { lead: { leadNumber: { contains: leadText } } } } });
    }

    const customerText = query.customer?.trim();
    if (customerText) {
      and.push({ leadDetails: { some: { fullName: { contains: customerText } } } });
    }

    const mobileText = query.mobile?.trim();
    if (mobileText) {
      and.push({ customer: { mobileNumber: { contains: mobileText } } });
    }

    const panText = query.pan?.trim();
    if (panText) {
      and.push({ leadDetails: { some: { panNumber: { contains: panText } } } });
    }

    const cibilRange = parseExportNumberRange(query.cibil, 'cibil');
    if (cibilRange) {
      and.push({
        cibilScore: {
          ...(cibilRange.min != null ? { gte: cibilRange.min } : {}),
          ...(cibilRange.max != null ? { lte: cibilRange.max } : {}),
        },
      });
    }

    const gradeText = query.grade?.trim();
    if (gradeText) {
      const grades = [...new Set(gradeText.split(',').map((g) => g.trim().toUpperCase()).filter(Boolean))];
      for (const grade of grades) {
        if (!CIBIL_CATEGORY_SET.has(grade as CibilCategory)) {
          throw new BadRequestException('grade must be a comma-separated list of A-H.');
        }
      }
      if (grades.length > 0) {
        and.push({ cibilCreditAssessment: { category: { in: grades } } });
      }
    }

    const sourceText = query.source?.trim().toLowerCase();
    if (sourceText) {
      if (sourceText !== 'live' && sourceText !== 'dummy') {
        throw new BadRequestException('source must be "live" or "dummy".');
      }
      and.push({ dummyFetched: sourceText === 'dummy' });
    }

    const fetchedRange = parseExportDatetimeRange(query.fetched, 'fetched');
    if (fetchedRange) {
      and.push({ createdAt: { gte: fetchedRange.start, lte: fetchedRange.end } });
    }

    return { AND: and };
  }
}
