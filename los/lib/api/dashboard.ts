import { cachedAuthorizedLosGet } from './_shared';

export type LosCrmDashboardDailyPoint = {
  date: string;
  newLeads: number;
  newApplications: number;
  disbursedCount: number;
  disbursedAmountInr: string | null;
};

export type LosCrmDashboardPayload = {
  generatedAt: string;
  activeAgentsToday: number;
  customers: number;
  newLeadsToday: number;
  newApplicationsToday: number;
  /** Last 14 UTC days (oldest → newest), including zeros. */
  dailySeries: LosCrmDashboardDailyPoint[];
  leadsByStatus: Array<{ code: string; label: string; count: number }>;
  applicationsByStatus: Array<{ code: string; label: string; count: number }>;
  pipeline: {
    freshLeads: number;
    applicationInProgress: number;
    kycPendingInReview: number;
    livenessPending: number;
    approvedCount: number;
    disbursedCount: number;
  };
  amounts: {
    sanctionedOpenPipelineInr: string | null;
    disbursedTodayInr: string | null;
    avgRequestedLoanInr: string | null;
  };
  credit: {
    approvalRatePercent: number | null;
    approvedTotal: number;
    rejectedTotal: number;
  };
  recentActivity: Array<{ id: string; title: string; actor: string; timeIso: string }>;
};

export async function getDashboardCrm(token: string): Promise<LosCrmDashboardPayload> {
  return cachedAuthorizedLosGet<LosCrmDashboardPayload>(
    token,
    '/dashboard/crm',
    'Failed to load dashboard',
  );
}
