import type { PrismaClient } from '@prisma/client';

/** Stable object key for generated CIBIL summary PDFs. */
export function defaultBureauReportPdfRelativePath(
  customerUuid: string,
  bureauReportUuid: string,
): string {
  return `customer/${customerUuid}/bureau-reports/${bureauReportUuid}/cibil-summary-report.pdf`;
}

/**
 * Reads `report_pdf_relative_path` via SQL so LOS/application reads work when
 * `@prisma/client` was not regenerated after the column was added.
 */
export async function loadBureauReportPdfRelativePath(
  client: PrismaClient,
  bureauReportUuid: string,
): Promise<string | null> {
  try {
    const rows = await client.$queryRaw<Array<{ report_pdf_relative_path: string | null }>>`
      SELECT report_pdf_relative_path
      FROM bureau_report
      WHERE uuid = ${bureauReportUuid}
      LIMIT 1
    `;
    const path = rows[0]?.report_pdf_relative_path?.trim();
    return path || null;
  } catch {
    return null;
  }
}

/** Persists PDF object key without requiring an up-to-date generated client. */
export async function persistBureauReportPdfRelativePath(
  client: PrismaClient,
  bureauReportId: bigint,
  relativePath: string,
): Promise<void> {
  await client.$executeRaw`
    UPDATE bureau_report
    SET report_pdf_relative_path = ${relativePath}
    WHERE id = ${bureauReportId}
  `;
}
