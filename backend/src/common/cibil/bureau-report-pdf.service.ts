import { Injectable, Logger } from '@nestjs/common';
import { KycFilesService } from '../kyc/kyc-files.service';
import { CibilReportPdfGeneratorService } from './cibil-report-pdf-generator.service';
import type { CibilReportData } from './cibil-report-data.extractor';
import {
  defaultBureauReportPdfRelativePath,
  loadBureauReportPdfRelativePath,
  persistBureauReportPdfRelativePath,
} from '../../prisma/bureau-report-pdf.query';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BureauReportPdfService {
  private readonly logger = new Logger(BureauReportPdfService.name);

  constructor(
    private readonly pdfGenerator: CibilReportPdfGeneratorService,
    private readonly kycFiles: KycFilesService,
    private readonly prisma: PrismaService,
  ) {}

  bureauReportPdfRelativePath(customerUuid: string, bureauReportUuid: string): string {
    return defaultBureauReportPdfRelativePath(customerUuid, bureauReportUuid);
  }

  private async publicUrlForRelativePath(relativePath: string): Promise<string | null> {
    return (
      (await this.kycFiles.resolvePublicReadUrl(relativePath)) ??
      this.kycFiles.publicReadUrl(relativePath)
    );
  }

  /**
   * Returns a public URL for the latest bureau PDF on this lead, generating and uploading the file
   * from stored `raw_payload` when it is missing in object storage.
   */
  async ensurePdfForLead(params: {
    leadId: bigint;
    customerUuid: string;
    force?: boolean;
  }): Promise<{ relativePath: string; publicUrl: string | null } | null> {
    const detail = await this.prisma.client.leadDetail.findUnique({
      where: { leadId: params.leadId },
      select: {
        bureauReport: {
          select: { id: true, uuid: true, rawPayload: true },
        },
      },
    });
    const row = detail?.bureauReport;
    if (!row) return null;

    return this.ensurePdfForReport({
      bureauReportId: row.id,
      customerUuid: params.customerUuid,
      bureauReportUuid: row.uuid,
      vendorBody: row.rawPayload ?? undefined,
      force: params.force,
    });
  }

  /**
   * Ensures the summary PDF exists at the expected object key; creates it from bureau JSON when not.
   */
  async ensurePdfForReport(params: {
    bureauReportId: bigint;
    customerUuid: string;
    bureauReportUuid: string;
    vendorBody?: unknown;
    force?: boolean;
  }): Promise<{ relativePath: string; publicUrl: string | null } | null> {
    const relativePath =
      (await loadBureauReportPdfRelativePath(this.prisma.client, params.bureauReportUuid)) ??
      this.bureauReportPdfRelativePath(params.customerUuid, params.bureauReportUuid);

    if (!params.force && (await this.kycFiles.exists(relativePath))) {
      await this.persistPdfPathIfMissing(params.bureauReportId, relativePath);
      return { relativePath, publicUrl: await this.publicUrlForRelativePath(relativePath) };
    }

    const vendorBody = params.vendorBody ?? (await this.loadRawPayload(params.bureauReportId));
    if (vendorBody == null) {
      this.logger.warn(
        `Bureau report PDF skipped: no raw_payload (bureauReportId=${params.bureauReportId.toString()})`,
      );
      return null;
    }

    return this.generateAndAttachForReport({ ...params, vendorBody });
  }

  private async persistPdfPathIfMissing(bureauReportId: bigint, relativePath: string): Promise<void> {
    try {
      await persistBureauReportPdfRelativePath(this.prisma.client, bureauReportId, relativePath);
    } catch (err) {
      this.logger.debug(
        `Could not persist bureau PDF path (bureauReportId=${bureauReportId.toString()}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async loadRawPayload(bureauReportId: bigint): Promise<unknown | null> {
    const row = await this.prisma.client.bureauReport.findUnique({
      where: { id: bureauReportId },
      select: { rawPayload: true },
    });
    return row?.rawPayload ?? null;
  }

  /**
   * Builds a CIBIL-style summary PDF in memory only (no upload, no DB path).
   * Used by LOS developer tooling.
   */
  async generateEphemeralPdf(vendorBody: unknown): Promise<Uint8Array> {
    return this.pdfGenerator.generatePdf(vendorBody);
  }

  async buildReportViewData(vendorBody: unknown): Promise<CibilReportData> {
    return this.pdfGenerator.buildEnrichedReportData(vendorBody);
  }

  /**
   * Builds a CIBIL-style summary PDF from TrueLink JSON only, uploads to Spaces/local storage,
   * and stores the object key on `bureau_report.report_pdf_relative_path`.
   */
  async generateAndAttachForReport(params: {
    bureauReportId: bigint;
    customerUuid: string;
    bureauReportUuid: string;
    vendorBody: unknown;
  }): Promise<{ relativePath: string; publicUrl: string | null } | null> {
    try {
      const pdf = await this.pdfGenerator.generatePdf(params.vendorBody);
      const relativePath = this.bureauReportPdfRelativePath(
        params.customerUuid,
        params.bureauReportUuid,
      );
      await this.kycFiles.writeBytes(relativePath, Buffer.from(pdf));

      await persistBureauReportPdfRelativePath(
        this.prisma.client,
        params.bureauReportId,
        relativePath,
      );

      return { relativePath, publicUrl: await this.publicUrlForRelativePath(relativePath) };
    } catch (err) {
      this.logger.warn(
        `Bureau report PDF not generated (bureauReportId=${params.bureauReportId.toString()}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}
