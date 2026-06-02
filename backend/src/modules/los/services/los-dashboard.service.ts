import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { LEAD_STATUS } from '../../../common/constants/lead.constants';
import { PrismaService } from '../../../prisma/prisma.service';

function displayName(name: string, custom: string | null): string {
  return (custom?.trim() || name).trim();
}

const DASHBOARD_DAILY_TREND_DAYS = 14;

function dashboardRowDayKey(d: Date | string): string {
  if (typeof d === 'string') {
    return d.length >= 10 ? d.slice(0, 10) : d;
  }
  return d.toISOString().slice(0, 10);
}

function lastUtcDayKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function utcDayBounds(dayKey: string): { gte: Date; lt: Date } {
  const gte = new Date(`${dayKey}T00:00:00.000Z`);
  const lt = new Date(gte.getTime() + 86_400_000);
  return { gte, lt };
}

function countByUtcDayKeys(dayKeys: string[], dates: Date[]): Map<string, number> {
  const keySet = new Set(dayKeys);
  const counts = new Map<string, number>();
  for (const key of dayKeys) {
    counts.set(key, 0);
  }
  for (const dt of dates) {
    const k = dashboardRowDayKey(dt);
    if (!keySet.has(k)) {
      continue;
    }
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

function sumDisbursementsByUtcDayKeys(
  dayKeys: string[],
  rows: Array<{ disbursedAt: Date | null; amount: Prisma.Decimal | null }>,
): Map<string, { count: number; amount: Prisma.Decimal }> {
  const keySet = new Set(dayKeys);
  const agg = new Map<string, { count: number; amount: Prisma.Decimal }>();
  for (const key of dayKeys) {
    agg.set(key, { count: 0, amount: new Prisma.Decimal(0) });
  }
  for (const row of rows) {
    if (!row.disbursedAt) {
      continue;
    }
    const k = dashboardRowDayKey(row.disbursedAt);
    if (!keySet.has(k)) {
      continue;
    }
    const cur = agg.get(k)!;
    cur.count += 1;
    if (row.amount != null) {
      cur.amount = cur.amount.add(row.amount);
    }
  }
  return agg;
}

type LosDashboardDailyPoint = {
  date: string;
  newLeads: number;
  newApplications: number;
  disbursedCount: number;
  disbursedAmountInr: string | null;
};

function mergeLosDashboardDailySeries(
  keys: string[],
  leadRows: Array<{ d: Date | string; c: bigint }>,
  appRows: Array<{ d: Date | string; c: bigint }>,
  disbRows: Array<{ d: Date | string; c: bigint; amt: unknown }>,
): LosDashboardDailyPoint[] {
  const leadMap = new Map<string, number>();
  const appMap = new Map<string, number>();
  const disbMap = new Map<string, { count: number; amount: string | null }>();
  for (const r of leadRows) {
    leadMap.set(dashboardRowDayKey(r.d), Number(r.c));
  }
  for (const r of appRows) {
    appMap.set(dashboardRowDayKey(r.d), Number(r.c));
  }
  for (const r of disbRows) {
    const k = dashboardRowDayKey(r.d);
    const raw = r.amt;
    const amount = raw === null || raw === undefined ? null : String(raw);
    disbMap.set(k, { count: Number(r.c), amount });
  }
  return keys.map((date) => {
    const dis = disbMap.get(date);
    return {
      date,
      newLeads: leadMap.get(date) ?? 0,
      newApplications: appMap.get(date) ?? 0,
      disbursedCount: dis?.count ?? 0,
      disbursedAmountInr: dis?.amount ?? null,
    };
  });
}

@Injectable()
export class LosDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async fetchDashboardDailyTrends(
    dayKeys: string[],
  ): Promise<{
    leadRows: Array<{ d: Date; c: bigint }>;
    appRows: Array<{ d: Date; c: bigint }>;
    disbRows: Array<{ d: Date; c: bigint; amt: unknown }>;
  }> {
    if (dayKeys.length === 0) {
      return { leadRows: [], appRows: [], disbRows: [] };
    }

    const prisma = this.prisma.client;
    const { gte: seriesSince } = utcDayBounds(dayKeys[0]!);
    const { lt: seriesUntil } = utcDayBounds(dayKeys[dayKeys.length - 1]!);

    const [leads, applications, disbursements] = await Promise.all([
      prisma.lead.findMany({
        where: { createdAt: { gte: seriesSince, lt: seriesUntil } },
        select: { createdAt: true },
      }),
      prisma.application.findMany({
        where: { createdAt: { gte: seriesSince, lt: seriesUntil } },
        select: { createdAt: true },
      }),
      prisma.applicationDisbursement.findMany({
        where: { disbursedAt: { gte: seriesSince, lt: seriesUntil } },
        select: { disbursedAt: true, amount: true },
      }),
    ]);

    const leadCounts = countByUtcDayKeys(
      dayKeys,
      leads.map((row) => row.createdAt),
    );
    const appCounts = countByUtcDayKeys(
      dayKeys,
      applications.map((row) => row.createdAt),
    );
    const disbAgg = sumDisbursementsByUtcDayKeys(dayKeys, disbursements);

    return {
      leadRows: dayKeys.map((key) => ({
        d: utcDayBounds(key).gte,
        c: BigInt(leadCounts.get(key) ?? 0),
      })),
      appRows: dayKeys.map((key) => ({
        d: utcDayBounds(key).gte,
        c: BigInt(appCounts.get(key) ?? 0),
      })),
      disbRows: dayKeys.map((key) => {
        const v = disbAgg.get(key)!;
        return { d: utcDayBounds(key).gte, c: BigInt(v.count), amt: v.amount };
      }),
    };
  }

  /** Aggregated LOS CRM dashboard (counts + small activity feed). */
  async getDashboardCrm() {
    const prisma = this.prisma.client;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const dayKeys = lastUtcDayKeys(DASHBOARD_DAILY_TREND_DAYS);

    const [
      activeAgentsToday,
      customerCount,
      leadGroups,
      applicationGroups,
      newApplicationsToday,
      newLeadsToday,
      disbursedTodayAgg,
      sanctionedPipelineAgg,
      avgLoanAgg,
      kycPendingInFlow,
      livenessPending,
      recentApplications,
      leadStatuses,
      applicationStatuses,
      dailyTrends,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          isActive: true,
          password: { not: null },
          lastLoginAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      prisma.customer.count(),
      prisma.lead.groupBy({
        by: ['leadStatusId'],
        where: { isActive: true },
        _count: { _all: true },
      }),
      prisma.application.groupBy({
        by: ['applicationStatusId'],
        _count: { _all: true },
      }),
      prisma.application.count({
        where: { createdAt: { gte: startOfDay, lt: endOfDay } },
      }),
      prisma.lead.count({
        where: { isActive: true, createdAt: { gte: startOfDay, lt: endOfDay } },
      }),
      prisma.applicationDisbursement.aggregate({
        where: { disbursedAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { amount: true },
      }),
      prisma.applicationEligibility.aggregate({
        where: {
          application: {
            applicationStatus: { name: APPLICATION_STATUS.APPROVED },
          },
        },
        _sum: { approvedAmount: true },
      }),
      prisma.applicationDetails.aggregate({
        where: { loanAmount: { not: null } },
        _avg: { loanAmount: true },
      }),
      prisma.application.count({
        where: {
          kycStatus: 0,
          applicationStatus: { name: { in: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.IN_REVIEW] } },
        },
      }),
      prisma.application.count({
        where: {
          kycStatus: 1,
          livenessPassed: false,
          applicationStatus: { name: { in: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.IN_REVIEW] } },
        },
      }),
      prisma.application.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
        select: {
          uuid: true,
          updatedAt: true,
          kycStatus: true,
          livenessPassed: true,
          applicationStatus: { select: { name: true, displayName: true } },
          lead: { select: { leadDetail: { select: { fullName: true } } } },
          customer: { select: { mobileNumber: true } },
        },
      }),
      prisma.leadStatus.findMany({ select: { id: true, name: true, displayName: true } }),
      prisma.applicationStatus.findMany({ select: { id: true, name: true, displayName: true } }),
      this.fetchDashboardDailyTrends(dayKeys),
    ]);

    const { leadRows: leadDailyRows, appRows: appDailyRows, disbRows: disbDailyRows } = dailyTrends;

    const leadStatusById = new Map(leadStatuses.map((s) => [s.id, s]));
    const applicationStatusById = new Map(applicationStatuses.map((s) => [s.id, s]));

    const leadsByStatus = leadGroups.map((g) => {
      const s = leadStatusById.get(g.leadStatusId);
      return {
        code: s?.name ?? String(g.leadStatusId),
        label: displayName(s?.name ?? 'UNKNOWN', s?.displayName ?? null),
        count: g._count._all,
      };
    });

    const applicationsByStatus = applicationGroups.map((g) => {
      const s = applicationStatusById.get(g.applicationStatusId);
      return {
        code: s?.name ?? String(g.applicationStatusId),
        label: displayName(s?.name ?? 'UNKNOWN', s?.displayName ?? null),
        count: g._count._all,
      };
    });

    const countByLeadCode = (codes: readonly string[]) =>
      leadsByStatus.filter((row) => codes.includes(row.code)).reduce((a, b) => a + b.count, 0);

    const countByAppCode = (codes: readonly string[]) =>
      applicationsByStatus.filter((row) => codes.includes(row.code)).reduce((a, b) => a + b.count, 0);

    const freshLeads = countByLeadCode([LEAD_STATUS.NEW, LEAD_STATUS.IN_PROGRESS]);
    const applicationInProgress = countByAppCode([APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.IN_REVIEW]);
    const approvedCount = countByAppCode([APPLICATION_STATUS.APPROVED]);
    const disbursedCount = countByAppCode([APPLICATION_STATUS.DISBURSED]);
    const rejectedAppCount = countByAppCode([APPLICATION_STATUS.REJECTED]);
    const decided = approvedCount + rejectedAppCount;
    const approvalRatePercent = decided > 0 ? Math.round((approvedCount / decided) * 100) : null;

    const recentActivity = recentApplications.map((app) => {
      const name = app.lead.leadDetail?.fullName?.trim() || 'Borrower';
      const mobile = app.customer.mobileNumber;
      const tail = mobile.length >= 4 ? mobile.slice(-4) : mobile;
      const statusLabel = displayName(app.applicationStatus.name, app.applicationStatus.displayName);
      const title =
        app.applicationStatus.name === APPLICATION_STATUS.DISBURSED
          ? 'Disbursement recorded'
          : app.applicationStatus.name === APPLICATION_STATUS.APPROVED
            ? 'Loan sanctioned'
            : app.kycStatus === 1
              ? 'KYC cleared'
              : app.applicationStatus.name === APPLICATION_STATUS.IN_REVIEW
                ? 'Credit review queue'
                : 'Application updated';

      return {
        id: app.uuid,
        title,
        actor: `${name} · …${tail} — now ${statusLabel}.`,
        timeIso: app.updatedAt.toISOString(),
      };
    });

    const dailySeries = mergeLosDashboardDailySeries(dayKeys, leadDailyRows, appDailyRows, disbDailyRows);

    return {
      generatedAt: new Date().toISOString(),
      activeAgentsToday,
      customers: customerCount,
      newLeadsToday,
      newApplicationsToday,
      dailySeries,
      leadsByStatus,
      applicationsByStatus,
      pipeline: {
        freshLeads,
        applicationInProgress,
        kycPendingInReview: kycPendingInFlow,
        livenessPending,
        approvedCount,
        disbursedCount,
      },
      amounts: {
        sanctionedOpenPipelineInr: sanctionedPipelineAgg._sum.approvedAmount?.toString() ?? null,
        disbursedTodayInr: disbursedTodayAgg._sum.amount?.toString() ?? null,
        avgRequestedLoanInr: avgLoanAgg._avg.loanAmount?.toString() ?? null,
      },
      credit: {
        approvalRatePercent,
        approvedTotal: approvedCount,
        rejectedTotal: rejectedAppCount,
      },
      recentActivity,
    };
  }
}
