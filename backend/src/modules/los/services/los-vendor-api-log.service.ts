import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, VendorHttpMethod } from '@prisma/client';
import { classifyVendorApiLogOutcome } from '../../../common/vendor/vendor-api-log-outcome.util';
import { PrismaService } from '../../../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class LosVendorApiLogService {
  constructor(private readonly prisma: PrismaService) {}

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

    const providerName = query.providerName?.trim();
    if (providerName) where.providerName = { contains: providerName };

    const serviceName = query.serviceName?.trim();
    if (serviceName) where.serviceName = { contains: serviceName };

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
      where.lead = {
        applications: {
          some: {
            applicationNumber: { contains: applicationNumber },
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
