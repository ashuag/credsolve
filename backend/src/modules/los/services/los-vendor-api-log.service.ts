import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type VendorHttpMethod } from '@prisma/client';
import type { Response } from 'express';
import { classifyVendorApiLogOutcome } from '../../../common/vendor/vendor-api-log-outcome.util';
import { streamXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';
import { requireAtLeastOneExportFilter } from '../../../common/xlsx/export-row-filter.util';
import { PrismaService } from '../../../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
/** Excel cells max out near 32,767 chars — truncate payloads so the workbook stays openable. */
const EXCEL_CELL_TEXT_LIMIT = 32000;
/**
 * Batch size for the export's cursor-paged fetch. A filtered dump can be tens of thousands of
 * rows, and each DB round-trip has fixed overhead, so too small a batch turns a large export into
 * thousands of round-trips (measured: 25 → ~2,400 round-trips for a 60k-row dump, dominating total
 * export time). 500 cuts that ~5x. Per-batch memory is bounded well below what row count alone
 * would suggest — see `fetchExportPayloadDetails` below, which never materializes a row's full
 * request/response JSON in Node.
 */
const EXPORT_BATCH_SIZE = 500;

/** Fields that gate the export — at least one must be set so a dump can't be pulled unfiltered. Also used to build the export filename's filter summary (see the controller). */
export const EXPORT_FILTER_KEYS = [
  'providerName',
  'serviceName',
  'requestMethod',
  'httpStatus',
  'id',
  'leadId',
  'applicationNumber',
  'requestPath',
  'outcome',
  'requestedFrom',
  'requestedTo',
] as const;

const VENDOR_API_LOG_DUMP_HEADERS = [
  'UUID',
  'Application ID',
  'Provider',
  'Service',
  'Method',
  'HTTP status',
  'Outcome',
  'Requested at',
  'Responded at',
  'Duration (ms)',
  'Request payload',
  'Response payload',
] as const;

/** Parses a comma-separated multi-select filter value into a deduped, trimmed list. */
function parseCsvList(raw: string | undefined): string[] {
  const value = raw?.trim();
  if (!value) return [];
  return [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];
}

/** `request_payload_text`/`response_payload_text` already come back ≤ `EXCEL_CELL_TEXT_LIMIT` chars
 *  (truncated in SQL — see `fetchExportPayloadDetails`); this only adds the "…(truncated)" marker
 *  when the text hit that ceiling. (A payload landing on exactly 32000 chars with nothing cut off
 *  would be mislabeled too, but that's indistinguishable from here and the case is negligible.) */
function finalizePayloadText(text: string | null): string | null {
  if (text == null) return null;
  return text.length >= EXCEL_CELL_TEXT_LIMIT ? `${text}…(truncated)` : text;
}

/**
 * Shape of one row from `fetchExportPayloadDetails`'s raw query: the truncated display text for
 * both payload columns, plus `response_payload` fields shallow-extracted via `JSON_EXTRACT` at
 * depth 0-4 under `data` (mirroring exactly what `extractVendorResponseStatusCode` recurses
 * through) and `vendorResponse` at each of those levels.
 */
type ExportPayloadRow = {
  id: bigint;
  request_payload_text: string | null;
  response_payload_text: string | null;
  l0_status: string | null;
  l0_success: unknown;
  l0_serviceError: unknown;
  l0_serviceStatusCode: number | null;
  l0_statusCode: number | null;
  l0_vendorResponse: unknown;
  l1_serviceStatusCode: number | null;
  l1_statusCode: number | null;
  l1_vendorResponse: unknown;
  l2_serviceStatusCode: number | null;
  l2_statusCode: number | null;
  l2_vendorResponse: unknown;
  l3_serviceStatusCode: number | null;
  l3_statusCode: number | null;
  l3_vendorResponse: unknown;
  l4_serviceStatusCode: number | null;
  l4_statusCode: number | null;
  l4_vendorResponse: unknown;
};

/**
 * Reconstructs just enough of a `response_payload` shape from `ExportPayloadRow`'s shallow
 * `JSON_EXTRACT` fields to feed the real, unchanged `classifyVendorApiLogOutcome` — avoiding the
 * cost of fetching/parsing the full (sometimes multi-MB) payload just to classify it.
 *
 * MUST stay in lockstep with what `classifyVendorApiLogOutcome` (vendor-api-log-outcome.util.ts)
 * and its helpers (vendor-api-error.util.ts: `extractVendorResponseStatusCode`,
 * `extractVendorServiceError`; aadhaar-vendor-parse.util.ts: `isTenacioVendorBusinessSuccess`)
 * actually read: `status`, `success`, `serviceError` at the top level, and `serviceStatusCode` /
 * `statusCode` / `vendorResponse` at the top level and at each of up to 4 nested `data` levels
 * (`extractVendorResponseStatusCode`'s recursion cap). If those functions start reading a new
 * field or recursing deeper, this — and the SQL in `fetchExportPayloadDetails` — must be updated
 * too, or the export's "Outcome" column can silently diverge from the real classification.
 * Verified against all locally-seeded rows with zero mismatches before shipping (see PR/commit).
 */
function buildOutcomeShadow(row: ExportPayloadRow): Record<string, unknown> {
  function level(depth: 0 | 1 | 2 | 3 | 4): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    const serviceStatusCode = row[`l${depth}_serviceStatusCode`];
    const statusCode = row[`l${depth}_statusCode`];
    const vendorResponse = row[`l${depth}_vendorResponse`];
    if (serviceStatusCode != null) obj.serviceStatusCode = serviceStatusCode;
    if (statusCode != null) obj.statusCode = statusCode;
    if (vendorResponse != null) obj.vendorResponse = vendorResponse;
    return obj;
  }
  const shadow: Record<string, unknown> = {
    ...level(0),
    data: { ...level(1), data: { ...level(2), data: { ...level(3), data: level(4) } } },
  };
  if (row.l0_status != null) shadow.status = row.l0_status;
  if (row.l0_success != null) shadow.success = row.l0_success;
  if (row.l0_serviceError != null) shadow.serviceError = row.l0_serviceError;
  return shadow;
}

const SORT_KEYS = [
  'id',
  'providerName',
  'serviceName',
  'requestMethod',
  'httpStatus',
  'leadId',
  'requestedAt',
  'respondedAt',
] as const;

export type VendorApiLogSortKey = (typeof SORT_KEYS)[number];

export type ListVendorApiLogsQuery = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  providerName?: string;
  serviceName?: string;
  requestMethod?: string;
  httpStatus?: string;
  id?: string;
  leadId?: string;
  applicationNumber?: string;
  requestPath?: string;
  outcome?: string;
  requestedFrom?: string;
  requestedTo?: string;
};

export type VendorApiLogListItem = {
  id: string;
  uuid: string;
  providerName: string;
  serviceName: string;
  requestMethod: string;
  requestPath: string | null;
  leadId: string | null;
  applicationUuid: string | null;
  applicationNumber: string | null;
  httpStatus: number | null;
  requestedAt: string;
  respondedAt: string;
  durationMs: number;
  outcome: 'success' | 'failure';
};

export type VendorApiLogDetail = VendorApiLogListItem & {
  requestHeaders: unknown;
  requestPayload: unknown;
  responsePayload: unknown;
};

export type ListVendorApiLogsResult = {
  items: VendorApiLogListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type VendorApiLogFilterOptions = {
  providerNames: string[];
  serviceNames: string[];
};

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class LosVendorApiLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Distinct provider/service names for the Vendor API Logs filter dropdowns. Both are the
   * leftmost column of an index (`providerName, requestedAt` / `serviceName, requestedAt`), so
   * this is an index-only scan rather than a table scan.
   */
  async listFilterOptions(): Promise<VendorApiLogFilterOptions> {
    const [providers, services] = await Promise.all([
      this.prisma.read.vendorApiLog.findMany({
        distinct: ['providerName'],
        select: { providerName: true },
        orderBy: { providerName: 'asc' },
      }),
      this.prisma.read.vendorApiLog.findMany({
        distinct: ['serviceName'],
        select: { serviceName: true },
        orderBy: { serviceName: 'asc' },
      }),
    ]);
    return {
      providerNames: providers.map((row) => row.providerName),
      serviceNames: services.map((row) => row.serviceName),
    };
  }

  async list(query: ListVendorApiLogsQuery): Promise<ListVendorApiLogsResult> {
    const page = Math.max(1, Math.floor(query.page ?? 1) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(query.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
    );
    const sortBy = this.parseSortBy(query.sortBy);
    const sortDir = query.sortDir?.trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.read.$transaction([
      this.prisma.read.vendorApiLog.count({ where }),
      this.prisma.read.vendorApiLog.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          uuid: true,
          providerName: true,
          serviceName: true,
          requestMethod: true,
          requestPath: true,
          leadId: true,
          httpStatus: true,
          requestedAt: true,
          respondedAt: true,
          lead: {
            select: {
              applications: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { uuid: true, applicationNumber: true },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows.map((row) => this.toListItem(row)),
      page: Math.min(page, totalPages),
      pageSize,
      total,
      totalPages,
    };
  }

  async getByUuid(uuid: string): Promise<VendorApiLogDetail> {
    const id = uuid.trim();
    if (!id) throw new BadRequestException('uuid is required.');

    const row = await this.prisma.read.vendorApiLog.findUnique({
      where: { uuid: id },
      include: {
        lead: {
          select: {
            applications: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { uuid: true, applicationNumber: true },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Vendor API log not found.');

    const base = this.toListItem(row, row.responsePayload);
    return {
      ...base,
      requestHeaders: row.requestHeaders ?? null,
      requestPayload: row.requestPayload ?? null,
      responsePayload: row.responsePayload ?? null,
    };
  }

  /**
   * Dump export: requires at least one filter (see EXPORT_FILTER_KEYS) to avoid unbounded loads,
   * and streams the result straight to `res` — cursor-paged from the DB (never loads every row's
   * request/response payload into memory at once) and deflated off the main thread as it's
   * written, so a large dump doesn't stall the event loop for the rest of the server.
   */
  async exportWorkbook(query: ListVendorApiLogsQuery, res: Response): Promise<void> {
    requireAtLeastOneExportFilter(
      EXPORT_FILTER_KEYS.map((key) => query[key]?.toString()),
      'Apply at least one filter before downloading the vendor API log dump.',
    );
    const where = this.buildWhere(query);

    await streamXlsxWorkbook(res, {
      sheetName: 'Vendor API Logs',
      headers: VENDOR_API_LOG_DUMP_HEADERS,
      rows: this.streamRowsForExport(where),
    });
  }

  /**
   * Truncated display text for both payload columns plus the shallow `JSON_EXTRACT` fields
   * `buildOutcomeShadow` needs — for exactly the ids in one export batch. Raw SQL because neither
   * a truncated-text projection nor a `JSON_EXTRACT` projection is expressible through Prisma's
   * typed `select`; `Prisma.join`/tagged-template params keep it injection-safe.
   */
  private fetchExportPayloadDetails(ids: bigint[]): Promise<ExportPayloadRow[]> {
    return this.prisma.read.$queryRaw<ExportPayloadRow[]>`
      SELECT id,
        LEFT(CAST(request_payload AS CHAR), ${EXCEL_CELL_TEXT_LIMIT}) AS request_payload_text,
        LEFT(CAST(response_payload AS CHAR), ${EXCEL_CELL_TEXT_LIMIT}) AS response_payload_text,
        JSON_EXTRACT(response_payload, '$.status') AS l0_status,
        JSON_EXTRACT(response_payload, '$.success') AS l0_success,
        JSON_EXTRACT(response_payload, '$.serviceError') AS l0_serviceError,
        JSON_EXTRACT(response_payload, '$.serviceStatusCode') AS l0_serviceStatusCode,
        JSON_EXTRACT(response_payload, '$.statusCode') AS l0_statusCode,
        JSON_EXTRACT(response_payload, '$.vendorResponse') AS l0_vendorResponse,
        JSON_EXTRACT(response_payload, '$.data.serviceStatusCode') AS l1_serviceStatusCode,
        JSON_EXTRACT(response_payload, '$.data.statusCode') AS l1_statusCode,
        JSON_EXTRACT(response_payload, '$.data.vendorResponse') AS l1_vendorResponse,
        JSON_EXTRACT(response_payload, '$.data.data.serviceStatusCode') AS l2_serviceStatusCode,
        JSON_EXTRACT(response_payload, '$.data.data.statusCode') AS l2_statusCode,
        JSON_EXTRACT(response_payload, '$.data.data.vendorResponse') AS l2_vendorResponse,
        JSON_EXTRACT(response_payload, '$.data.data.data.serviceStatusCode') AS l3_serviceStatusCode,
        JSON_EXTRACT(response_payload, '$.data.data.data.statusCode') AS l3_statusCode,
        JSON_EXTRACT(response_payload, '$.data.data.data.vendorResponse') AS l3_vendorResponse,
        JSON_EXTRACT(response_payload, '$.data.data.data.data.serviceStatusCode') AS l4_serviceStatusCode,
        JSON_EXTRACT(response_payload, '$.data.data.data.data.statusCode') AS l4_statusCode,
        JSON_EXTRACT(response_payload, '$.data.data.data.data.vendorResponse') AS l4_vendorResponse
      FROM vendor_api_log
      WHERE id IN (${Prisma.join(ids)})
    `;
  }

  private async *streamRowsForExport(
    where: Prisma.VendorApiLogWhereInput,
  ): AsyncGenerator<SimpleXlsxCell[]> {
    let cursorId: bigint | undefined;
    for (;;) {
      const batch = await this.prisma.read.vendorApiLog.findMany({
        take: EXPORT_BATCH_SIZE,
        ...(cursorId != null ? { skip: 1, cursor: { id: cursorId } } : {}),
        where,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          uuid: true,
          providerName: true,
          serviceName: true,
          requestMethod: true,
          httpStatus: true,
          requestedAt: true,
          respondedAt: true,
          lead: {
            select: {
              applications: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { applicationNumber: true },
              },
            },
          },
        },
      });
      if (batch.length === 0) return;

      const details = await this.fetchExportPayloadDetails(batch.map((row) => row.id));
      const detailsById = new Map(details.map((detail) => [detail.id.toString(), detail]));

      for (const row of batch) {
        const detail = detailsById.get(row.id.toString());
        const durationMs = Math.max(0, row.respondedAt.getTime() - row.requestedAt.getTime());
        const outcome = classifyVendorApiLogOutcome(row.httpStatus, detail ? buildOutcomeShadow(detail) : null);
        const application = row.lead?.applications[0] ?? null;
        yield [
          row.uuid,
          application?.applicationNumber ?? null,
          row.providerName,
          row.serviceName,
          row.requestMethod,
          row.httpStatus,
          outcome,
          row.requestedAt,
          row.respondedAt,
          durationMs,
          finalizePayloadText(detail?.request_payload_text ?? null),
          finalizePayloadText(detail?.response_payload_text ?? null),
        ];
      }

      cursorId = batch[batch.length - 1]!.id;
      if (batch.length < EXPORT_BATCH_SIZE) return;
    }
  }

  private toListItem(
    row: {
      id: bigint;
      uuid: string;
      providerName: string;
      serviceName: string;
      requestMethod: string;
      requestPath: string | null;
      leadId: bigint | null;
      httpStatus: number | null;
      requestedAt: Date;
      respondedAt: Date;
      lead?: {
        applications: Array<{ uuid: string; applicationNumber: string }>;
      } | null;
    },
    responsePayload?: unknown,
  ): VendorApiLogListItem {
    const durationMs = Math.max(0, row.respondedAt.getTime() - row.requestedAt.getTime());
    const outcome =
      responsePayload !== undefined
        ? classifyVendorApiLogOutcome(row.httpStatus, responsePayload)
        : this.outcomeFromHttpStatus(row.httpStatus);
    const application = row.lead?.applications[0] ?? null;
    return {
      id: row.id.toString(),
      uuid: row.uuid,
      providerName: row.providerName,
      serviceName: row.serviceName,
      requestMethod: row.requestMethod,
      requestPath: row.requestPath,
      leadId: row.leadId != null ? row.leadId.toString() : null,
      applicationUuid: application?.uuid ?? null,
      applicationNumber: application?.applicationNumber ?? null,
      httpStatus: row.httpStatus,
      requestedAt: row.requestedAt.toISOString(),
      respondedAt: row.respondedAt.toISOString(),
      durationMs,
      outcome,
    };
  }

  /** List view avoids loading response JSON — approximate from HTTP status. */
  private outcomeFromHttpStatus(httpStatus: number | null): 'success' | 'failure' {
    if (httpStatus == null) return 'failure';
    return httpStatus >= 200 && httpStatus < 300 ? 'success' : 'failure';
  }

  private parseSortBy(raw: string | undefined): VendorApiLogSortKey {
    const key = (raw ?? 'requestedAt').trim();
    if ((SORT_KEYS as readonly string[]).includes(key)) {
      return key as VendorApiLogSortKey;
    }
    return 'requestedAt';
  }

  private buildWhere(query: ListVendorApiLogsQuery): Prisma.VendorApiLogWhereInput {
    const where: Prisma.VendorApiLogWhereInput = {};

    // Exact `in` match, not `contains`: providerName/serviceName are a small fixed set of vendor
    // integrations (the UI offers them as a multi-select of known values, not free text), and an
    // exact match lets this use the providerName/serviceName + requestedAt indexes — a
    // leading-wildcard `contains` can't use a B-tree index at all.
    const providerNames = parseCsvList(query.providerName);
    if (providerNames.length > 0) where.providerName = { in: providerNames };

    const serviceNames = parseCsvList(query.serviceName);
    if (serviceNames.length > 0) where.serviceName = { in: serviceNames };

    const method = query.requestMethod?.trim().toUpperCase();
    if (method) {
      if (!HTTP_METHODS.has(method)) {
        throw new BadRequestException('requestMethod must be GET, POST, PUT, PATCH, or DELETE.');
      }
      where.requestMethod = method as VendorHttpMethod;
    }

    const httpStatusRaw = query.httpStatus?.trim();
    if (httpStatusRaw) {
      const status = Number(httpStatusRaw);
      if (!Number.isInteger(status)) {
        throw new BadRequestException('httpStatus must be an integer.');
      }
      where.httpStatus = status;
    }

    const idRaw = query.id?.trim();
    if (idRaw) {
      if (!/^\d+$/.test(idRaw)) {
        throw new BadRequestException('id must be a numeric log id.');
      }
      where.id = BigInt(idRaw);
    }

    const leadIdRaw = query.leadId?.trim();
    if (leadIdRaw) {
      if (!/^\d+$/.test(leadIdRaw)) {
        throw new BadRequestException('leadId must be a numeric id.');
      }
      where.leadId = BigInt(leadIdRaw);
    }

    const applicationNumber = query.applicationNumber?.trim();
    if (applicationNumber) {
      // `startsWith`, not `contains`: application numbers are a fixed 12-char code people type or
      // paste from the start, and a prefix match can use application's `application_number` unique
      // index (a leading-wildcard `contains` cannot).
      where.lead = {
        applications: {
          some: {
            applicationNumber: { startsWith: applicationNumber },
          },
        },
      };
    }

    const requestPath = query.requestPath?.trim();
    if (requestPath) where.requestPath = { contains: requestPath };

    // Exact httpStatus wins over coarse outcome filter.
    const outcome = query.outcome?.trim().toLowerCase();
    if (!httpStatusRaw && outcome === 'success') {
      where.httpStatus = { gte: 200, lt: 300 };
    } else if (!httpStatusRaw && outcome === 'failure') {
      where.OR = [{ httpStatus: null }, { httpStatus: { lt: 200 } }, { httpStatus: { gte: 300 } }];
    } else if (!httpStatusRaw && outcome) {
      throw new BadRequestException('outcome must be success or failure.');
    }

    const from = this.parseDateBound(query.requestedFrom, 'requestedFrom');
    const to = this.parseDateBound(query.requestedTo, 'requestedTo', true);
    if (from || to) {
      where.requestedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    return where;
  }

  private parseDateBound(raw: string | undefined, field: string, endOfDay = false): Date | null {
    const value = raw?.trim();
    if (!value) return null;
    // Accept ISO or YYYY-MM-DD
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
      : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date.`);
    }
    return date;
  }
}
