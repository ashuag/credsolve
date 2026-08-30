import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  easebuzzUniqueRequestNumberForApplication,
  extractEasebuzzTransferRequest,
  parseEasebuzzQuickTransferInitiate,
  uniqueRequestNumberFromGatewayJson,
} from '../../../common/easebuzz/easebuzz-transfer-log.util';
import { EasebuzzWireService } from '../../../common/easebuzz/easebuzz-wire.service';
import { resolveEffectiveLoanStatus } from '../../../common/loan/effective-loan-status.util';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CheckDisbursementStatusDto } from '../dto/check-disbursement-status.dto';
import type { GetPaymentStatusDto } from '../dto/get-payment-status.dto';

export type GetPaymentStatusDryRunResult = {
  vendor: 'Easebuzz';
  configured: boolean;
  skipReason: string | null;
  retrieveUrl: string | null;
  txnid: string;
  ok: boolean;
  status: string | null;
  amount: string | null;
  easepayid: string | null;
  bankRef: string | null;
  message: string | null;
  vendorBody: unknown | null;
};

export type CheckDisbursementStatusRow = {
  applicationNumber: string;
  applicationUuid: string;
  loanNumber: string;
  uniqueRequestNumber: string;
  storedUtr: string | null;
  loanStatusCode: string;
  loanStatusLabel: string;
  disbursedAt: string;
  netDisbursedAmount: string;
  apiHttpOk: boolean;
  apiStatus: string | null;
  apiUtr: string | null;
  apiFailureReason: string | null;
  apiMessage: string | null;
  vendorBody: unknown | null;
};

export type CheckDisbursementStatusResult = {
  vendor: 'Easebuzz';
  configured: boolean;
  skipReason: string | null;
  retrieveUrl: string | null;
  filter: { applicationNumber: string | null; fromDate: string | null; toDate: string | null };
  matched: number;
  truncated: boolean;
  rows: CheckDisbursementStatusRow[];
};

const MAX_DISBURSEMENT_CHECKS = 40;

/**
 * LOS developer tool: live Easebuzz Transaction V2.1 retrieve.
 * Does not update loan_repayment or loan_account. The vendor call is audited
 * in vendor_api_log (leadId is null).
 */
@Injectable()
export class LosEasebuzzDevToolsService {
  constructor(
    private readonly easebuzzWire: EasebuzzWireService,
    private readonly prisma: PrismaService,
  ) {}

  async runGetPaymentStatus(dto: GetPaymentStatusDto): Promise<GetPaymentStatusDryRunResult> {
    const txnid = dto.txnid.trim().slice(0, 40);
    try {
      const txn = await this.easebuzzWire.retrievePayTransaction(txnid, { forceLive: true });
      return {
        vendor: 'Easebuzz',
        configured: true,
        skipReason: null,
        retrieveUrl: txn.retrieveUrl,
        txnid,
        ok: txn.ok,
        status: txn.status,
        amount: txn.amount,
        easepayid: txn.easepayid,
        bankRef: txn.bankRef,
        message: txn.message,
        vendorBody: txn.rawBody,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        const skipReason =
          typeof err.message === 'string' && err.message.trim()
            ? err.message
            : 'Easebuzz Payment Gateway is not configured.';
        return {
          vendor: 'Easebuzz',
          configured: false,
          skipReason,
          retrieveUrl: null,
          txnid,
          ok: false,
          status: null,
          amount: null,
          easepayid: null,
          bankRef: null,
          message: skipReason,
          vendorBody: null,
        };
      }
      throw err;
    }
  }

  /**
   * For unpaid disbursed loans, read the stored Easebuzz `quick-transfer-initiate`
   * vendor_api_log response and report transfer status. Does not call Easebuzz
   * and does not update loan_account.
   */
  async runCheckDisbursementStatus(
    dto: CheckDisbursementStatusDto,
  ): Promise<CheckDisbursementStatusResult> {
    const applicationNumber = dto.applicationNumber?.trim() || null;
    const applicationIds = parseApplicationIds(applicationNumber);
    const fromDate = dto.fromDate?.trim() || null;
    const toDate = dto.toDate?.trim() || null;

    if (applicationIds.length === 0 && !(fromDate && toDate)) {
      throw new BadRequestException('Provide application IDs, or both from and to dates.');
    }
    if (!applicationNumber && fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('fromDate must be on or before toDate.');
    }

    const applications =
      applicationIds.length > 0
        ? await this.prisma.read.application.findMany({
            where: {
              OR: [
                { applicationNumber: { in: applicationIds } },
                { uuid: { in: applicationIds } },
              ],
            },
            select: {
              uuid: true,
              applicationNumber: true,
              leadId: true,
              loanAccount: {
                select: {
                  loanNumber: true,
                  utr: true,
                  netDisbursedAmount: true,
                  disbursedAt: true,
                  closedAt: true,
                  loanMaturityDate: true,
                  gatewayTransferJson: true,
                  loanStatus: { select: { name: true, displayName: true } },
                },
              },
            },
          })
        : [];

    const loans =
      applicationIds.length > 0
        ? []
        : await this.prisma.read.loanAccount.findMany({
            where: {
              closedAt: null,
              disbursedAt: {
                gte: istDayStart(fromDate!),
                lt: istDayEndExclusive(toDate!),
              },
            },
            orderBy: { disbursedAt: 'desc' },
            take: MAX_DISBURSEMENT_CHECKS + 1,
            select: {
              loanNumber: true,
              utr: true,
              netDisbursedAmount: true,
              disbursedAt: true,
              closedAt: true,
              loanMaturityDate: true,
              gatewayTransferJson: true,
              loanStatus: { select: { name: true, displayName: true } },
              application: {
                select: { uuid: true, applicationNumber: true, leadId: true },
              },
            },
          });

    type CheckTarget = {
      requestedId: string;
      applicationNumber: string;
      applicationUuid: string;
      leadId: bigint | null;
      uniqueRequestNumber: string;
      loanNumber: string;
      storedUtr: string | null;
      netDisbursedAmount: string;
      disbursedAt: string | null;
      loanStatusCode: string;
      loanStatusLabel: string;
      gatewayTransferJson: unknown;
    };

    const targets: CheckTarget[] = [];
    if (applicationIds.length > 0) {
      const byNumber = new Map(applications.map((app) => [app.applicationNumber, app]));
      const byUuid = new Map(applications.map((app) => [app.uuid, app]));
      for (const id of applicationIds) {
        const app = byNumber.get(id) ?? byUuid.get(id) ?? null;
        const applicationNumberValue = app?.applicationNumber ?? id;
        const loan = app?.loanAccount ?? null;
        targets.push({
          requestedId: id,
          applicationNumber: applicationNumberValue,
          applicationUuid: app?.uuid ?? '',
          leadId: app?.leadId ?? null,
          uniqueRequestNumber: uniqueRequestNumberFromGatewayJson(
            loan?.gatewayTransferJson,
            applicationNumberValue,
          ),
          loanNumber: loan?.loanNumber ?? '',
          storedUtr: loan?.utr ?? null,
          netDisbursedAmount: loan?.netDisbursedAmount.toString() ?? '',
          disbursedAt: loan?.disbursedAt.toISOString() ?? null,
          loanStatusCode: loan
            ? resolveEffectiveLoanStatus({
                statusName: loan.loanStatus.name,
                statusDisplayName: loan.loanStatus.displayName,
                loanMaturityDate: loan.loanMaturityDate,
                closedAt: loan.closedAt,
              }).code
            : 'NO_LOAN',
          loanStatusLabel: loan
            ? resolveEffectiveLoanStatus({
                statusName: loan.loanStatus.name,
                statusDisplayName: loan.loanStatus.displayName,
                loanMaturityDate: loan.loanMaturityDate,
                closedAt: loan.closedAt,
              }).label
            : 'No loan account',
          gatewayTransferJson: loan?.gatewayTransferJson ?? null,
        });
      }
    } else {
      const truncatedLoans = loans.slice(0, MAX_DISBURSEMENT_CHECKS);
      for (const loan of truncatedLoans) {
        const status = resolveEffectiveLoanStatus({
          statusName: loan.loanStatus.name,
          statusDisplayName: loan.loanStatus.displayName,
          loanMaturityDate: loan.loanMaturityDate,
          closedAt: loan.closedAt,
        });
        targets.push({
          requestedId: loan.application.applicationNumber,
          applicationNumber: loan.application.applicationNumber,
          applicationUuid: loan.application.uuid,
          leadId: loan.application.leadId,
          uniqueRequestNumber: uniqueRequestNumberFromGatewayJson(
            loan.gatewayTransferJson,
            loan.application.applicationNumber,
          ),
          loanNumber: loan.loanNumber,
          storedUtr: loan.utr,
          netDisbursedAmount: loan.netDisbursedAmount.toString(),
          disbursedAt: loan.disbursedAt.toISOString(),
          loanStatusCode: status.code,
          loanStatusLabel: status.label,
          gatewayTransferJson: loan.gatewayTransferJson,
        });
      }
    }

    const truncated =
      applicationIds.length > 0 ? false : loans.length > MAX_DISBURSEMENT_CHECKS;
    const leadIds = [...new Set(targets.map((row) => row.leadId).filter((id): id is bigint => id != null))];
    const urns = [...new Set(targets.map((row) => row.uniqueRequestNumber).filter(Boolean))];

    const logs = await this.loadInitiateLogs(leadIds, urns);
    const logsByLead = new Map<string, typeof logs>();
    const logsByUrn = new Map<string, (typeof logs)[number]>();
    for (const log of logs) {
      if (log.leadId != null) {
        const key = log.leadId.toString();
        const list = logsByLead.get(key) ?? [];
        list.push(log);
        logsByLead.set(key, list);
      }
      const urn = uniqueRequestNumberFromLog(log);
      if (urn && !logsByUrn.has(urn)) logsByUrn.set(urn, log);
    }

    const rows: CheckDisbursementStatusRow[] = targets.map((target) => {
      const log =
        (target.leadId != null
          ? pickInitiateLog(logsByLead.get(target.leadId.toString()) ?? [], target.uniqueRequestNumber)
          : null) ??
        logsByUrn.get(target.uniqueRequestNumber) ??
        logsByUrn.get(easebuzzUniqueRequestNumberForApplication(target.applicationNumber)) ??
        null;
      const parsed = log?.responsePayload
        ? parseEasebuzzQuickTransferInitiate(log.responsePayload)
        : null;
      const httpOk = log?.httpStatus != null && log.httpStatus >= 200 && log.httpStatus < 300;

      return {
        applicationNumber: target.applicationNumber,
        applicationUuid: target.applicationUuid,
        loanNumber: target.loanNumber,
        uniqueRequestNumber: target.uniqueRequestNumber,
        storedUtr: target.storedUtr,
        loanStatusCode: target.loanStatusCode,
        loanStatusLabel: target.loanStatusLabel,
        disbursedAt: target.disbursedAt ?? '',
        netDisbursedAmount: target.netDisbursedAmount,
        apiHttpOk: httpOk,
        apiStatus: parsed?.vendorStatus ?? null,
        apiUtr: parsed?.transferId ?? null,
        apiFailureReason: parsed && !parsed.accepted ? parsed.message : null,
        apiMessage: log ? parsed?.message : 'No quick-transfer-initiate log found.',
        vendorBody: log?.responsePayload ?? null,
      };
    });

    return {
      vendor: 'Easebuzz',
      configured: true,
      skipReason: null,
      retrieveUrl: null,
      filter: { applicationNumber, fromDate, toDate },
      matched: rows.length,
      truncated,
      rows,
    };
  }

  private async loadInitiateLogs(
    leadIds: bigint[],
    urns: string[],
  ): Promise<
    Array<{
      leadId: bigint | null;
      httpStatus: number | null;
      requestPayload: unknown;
      responsePayload: unknown;
    }>
  > {
    const clauses: Prisma.Sql[] = [];
    if (leadIds.length > 0) {
      clauses.push(Prisma.sql`lead_id IN (${Prisma.join(leadIds)})`);
    }
    if (urns.length > 0) {
      const urnSql = Prisma.join(urns);
      clauses.push(
        Prisma.sql`JSON_UNQUOTE(JSON_EXTRACT(request_payload, '$.unique_request_number')) IN (${urnSql})`,
      );
      clauses.push(
        Prisma.sql`JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.data.transfer_request.unique_request_number')) IN (${urnSql})`,
      );
    }
    if (clauses.length === 0) return [];

    const rows = await this.prisma.read.$queryRaw<
      Array<{
        leadId: bigint | null;
        httpStatus: number | null;
        requestPayload: unknown;
        responsePayload: unknown;
      }>
    >`
      SELECT
        lead_id AS leadId,
        http_status AS httpStatus,
        request_payload AS requestPayload,
        response_payload AS responsePayload
      FROM vendor_api_log
      WHERE service_name = 'quick-transfer-initiate'
        AND (${Prisma.join(clauses, ' OR ')})
      ORDER BY requested_at DESC
      LIMIT 200
    `;
    return rows;
  }
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function uniqueRequestNumberFromRequest(payload: unknown): string | null {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const row = payload as Record<string, unknown>;
  return pickString(row.unique_request_number, row.uniqueRequestNumber);
}

function uniqueRequestNumberFromLog(log: {
  requestPayload: unknown;
  responsePayload: unknown;
}): string | null {
  const fromRequest = uniqueRequestNumberFromRequest(log.requestPayload);
  if (fromRequest) return fromRequest;
  const tr = extractEasebuzzTransferRequest(log.responsePayload);
  return pickString(tr?.unique_request_number);
}

function pickInitiateLog<T extends { requestPayload: unknown; responsePayload: unknown }>(
  logs: T[],
  uniqueRequestNumber: string,
): T | null {
  if (logs.length === 0) return null;
  const matched = logs.find((log) => uniqueRequestNumberFromLog(log) === uniqueRequestNumber);
  return matched ?? logs[0] ?? null;
}

function parseApplicationIds(raw: string | null): string[] {
  if (!raw) return [];
  if (/\s/.test(raw)) {
    throw new BadRequestException('Spaces are not allowed. Use comma-separated application IDs.');
  }
  const ids = raw.split(',').filter(Boolean);
  if (ids.length === 0) {
    throw new BadRequestException('Provide at least one application ID.');
  }
  if (ids.length > MAX_DISBURSEMENT_CHECKS) {
    throw new BadRequestException(`At most ${MAX_DISBURSEMENT_CHECKS} application IDs are allowed.`);
  }
  return [...new Set(ids)];
}

function istDayStart(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00+05:30`);
}

function istDayEndExclusive(yyyyMmDd: string): Date {
  const start = istDayStart(yyyyMmDd);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
