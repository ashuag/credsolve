'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardDailyCharts } from '@/components/dashboard/dashboard-daily-charts';
import { getDashboardCrm, type LosCrmDashboardPayload } from '@/lib/api';
import { canAccessLosConfigModules } from '@/lib/access';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import styles from '@/app/dashboard/dashboard.module.css';

type StoredLosSession = {
  token?: string;
  user?: { role?: string; roleName?: string; hierarchyLevel?: number | null };
};

function readSession(): StoredLosSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredLosSession;
  } catch {
    return null;
  }
}

function readToken(): string | null {
  return readSession()?.token ?? null;
}

function moneyFromDecimalString(s: string | null | undefined): string {
  if (s == null || s === '') return '—';
  const n = Number(s);
  if (Number.isNaN(n)) return `INR ${s}`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatActivityTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `Today ${time}` : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function tableTotal(rows: { count: number }[]) {
  return rows.reduce((s, r) => s + r.count, 0);
}

export function CrmDashboardClient() {
  const [data, setData] = useState<LosCrmDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) {
      setError('Session missing. Sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await getDashboardCrm(token);
      setData(payload);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const leadTotal = useMemo(() => (data ? tableTotal(data.leadsByStatus) : 0), [data]);
  const appStatusTotal = useMemo(() => (data ? tableTotal(data.applicationsByStatus) : 0), [data]);
  const canSeeTeamShortcut = useMemo(() => {
    const user = readSession()?.user;
    return canAccessLosConfigModules(user?.roleName ?? user?.role, user?.hierarchyLevel);
  }, []);

  if (loading && !data) {
    return (
      <div className={styles.dashboard} aria-busy="true">
        <div className={styles.reportSkeleton}>Loading dashboard…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.reportError}>
          <p className="m-0 text-[0.92rem] font-semibold text-red-900">{error}</p>
          <button type="button" className={styles.refreshBtn} onClick={() => void load()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const p = data.pipeline;
  const funnelTotal = p.freshLeads + p.applicationInProgress + p.approvedCount + p.disbursedCount;
  const approvalRate = data.credit.approvalRatePercent;
  const sameDayRatio =
    p.approvedCount > 0 ? Math.min(100, Math.round((p.disbursedCount / p.approvedCount) * 100)) : null;

  const funnelSteps = [
    { key: 'leads', label: 'Leads (new+IP)', n: p.freshLeads },
    { key: 'flow', label: 'Apps in flow', n: p.applicationInProgress },
    { key: 'appr', label: 'Approved', n: p.approvedCount },
    { key: 'disb', label: 'Disbursed', n: p.disbursedCount },
  ];

  const kpis = [
    { label: 'Sanctioned pipeline', value: moneyFromDecimalString(data.amounts.sanctionedOpenPipelineInr) },
    { label: 'Disbursed today (UTC)', value: moneyFromDecimalString(data.amounts.disbursedTodayInr) },
    { label: 'New apps today', value: String(data.newApplicationsToday) },
    { label: 'New leads today', value: String(data.newLeadsToday) },
    { label: 'Avg requested loan', value: moneyFromDecimalString(data.amounts.avgRequestedLoanInr) },
    { label: 'Customers', value: String(data.customers) },
    { label: 'Agents today', value: String(data.activeAgentsToday) },
    { label: 'Apps in flow', value: String(p.applicationInProgress) },
  ];

  return (
    <div className={styles.dashboard}>
      <header className={styles.reportHeader}>
        <div className={styles.quickLinks} aria-label="Shortcuts">
          <Link href="/leads" className={styles.quickLink}>
            Leads
          </Link>
          <Link href="/applications" className={styles.quickLink}>
            Applications
          </Link>
          {canSeeTeamShortcut ? (
            <Link href="/agents" className={styles.quickLink}>
              Team
            </Link>
          ) : null}
        </div>
        <div className={styles.reportHeaderMeta}>
          <span className={styles.reportStamp}>
            {new Date(data.generatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className={styles.reportUtc}>“Today” = UTC midnight</span>
          <button type="button" className={styles.refreshBtnInline} onClick={() => void load()} disabled={loading}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </header>

      <section className={styles.kpiGrid} aria-label="Key metrics">
        {kpis.map((k) => (
          <div key={k.label} className={styles.kpiCell}>
            <span className={styles.kpiLabel}>{k.label}</span>
            <span className={styles.kpiValue}>{k.value}</span>
          </div>
        ))}
      </section>

      <DashboardDailyCharts series={data.dailySeries ?? []} />

      <section className={styles.queueStrip} aria-label="Verification queue">
        <span className={styles.queueItem}>
          <strong>{p.kycPendingInReview}</strong> KYC pending (draft/review)
        </span>
        <span className={styles.queueSep} aria-hidden>
          |
        </span>
        <span className={styles.queueItem}>
          <strong>{p.livenessPending}</strong> liveness pending (KYC done)
        </span>
        <span className={styles.queueSep} aria-hidden>
          |
        </span>
        <span className={styles.queueItem}>
          <strong>{p.freshLeads}</strong> leads (new + in progress)
        </span>
        <span className={styles.queueSep} aria-hidden>
          |
        </span>
        <span className={styles.queueItem}>
          Credit: <strong>{approvalRate != null ? `${approvalRate}%` : '—'}</strong> win ({data.credit.approvedTotal}A / {data.credit.rejectedTotal}R)
        </span>
        <span className={styles.queueSep} aria-hidden>
          |
        </span>
        <span className={styles.queueItem}>
          Disbursed / approved: <strong>{sameDayRatio != null ? `${sameDayRatio}%` : '—'}</strong>
        </span>
      </section>

      <section className={styles.funnelSection} aria-label="Pipeline funnel">
        <h2 className={styles.reportSectionTitle}>Pipeline (headline buckets)</h2>
        <div className={styles.funnelRow}>
          {funnelSteps.map((step, i) => (
            <div key={step.key} className={styles.funnelStep}>
              {i > 0 ? <span className={styles.funnelArrow} aria-hidden>→</span> : null}
              <div className={styles.funnelBox}>
                <span className={styles.funnelN}>{step.n}</span>
                <span className={styles.funnelL}>{step.label}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.funnelBarTrack} aria-hidden>
          {funnelSteps.map((step) => (
            <div
              key={`bar-${step.key}`}
              className={styles.funnelBarSeg}
              style={{ flexGrow: Math.max(1, step.n) }}
              title={`${step.label}: ${step.n}`}
            />
          ))}
        </div>
        {funnelTotal > 0 ? (
          <table className={`${styles.reportTable} ${styles.reportTableTight}`}>
            <tbody>
              {funnelSteps.map((s) => (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td className={styles.num}>{s.n}</td>
                  <td className={styles.num}>{percent(s.n, funnelTotal)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <div className={styles.reportTwoCol}>
        <div className={styles.reportCol}>
          <div className={styles.reportPanel}>
            <h2 className={styles.reportSectionTitle}>Leads by status</h2>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th className={styles.num}>Count</th>
                  <th className={styles.num}>%</th>
                </tr>
              </thead>
              <tbody>
                {data.leadsByStatus
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <tr key={row.code}>
                      <td title={row.code}>{row.label}</td>
                      <td className={styles.num}>{row.count}</td>
                      <td className={styles.num}>{leadTotal ? percent(row.count, leadTotal) : 0}%</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className={styles.num}>{leadTotal}</td>
                  <td className={styles.num}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={styles.reportPanel}>
            <h2 className={styles.reportSectionTitle}>Applications by status</h2>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th className={styles.num}>Count</th>
                  <th className={styles.num}>%</th>
                </tr>
              </thead>
              <tbody>
                {data.applicationsByStatus
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <tr key={row.code}>
                      <td title={row.code}>{row.label}</td>
                      <td className={styles.num}>{row.count}</td>
                      <td className={styles.num}>{appStatusTotal ? percent(row.count, appStatusTotal) : 0}%</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className={styles.num}>{appStatusTotal}</td>
                  <td className={styles.num}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className={styles.reportCol}>
          <div className={styles.reportPanel}>
            <h2 className={styles.reportSectionTitle}>Throughput</h2>
            <table className={styles.reportTable}>
              <tbody>
                <tr>
                  <td>Approval rate (A / A+R)</td>
                  <td className={styles.num}>{approvalRate != null ? `${approvalRate}%` : '—'}</td>
                </tr>
                <tr>
                  <td>Approved count</td>
                  <td className={styles.num}>{data.credit.approvedTotal}</td>
                </tr>
                <tr>
                  <td>Rejected count</td>
                  <td className={styles.num}>{data.credit.rejectedTotal}</td>
                </tr>
                <tr>
                  <td>Disbursed / approved</td>
                  <td className={styles.num}>{sameDayRatio != null ? `${sameDayRatio}%` : '—'}</td>
                </tr>
                <tr>
                  <td>Apps in draft + review</td>
                  <td className={styles.num}>{p.applicationInProgress}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.reportPanel}>
            <h2 className={styles.reportSectionTitle}>Recent application updates</h2>
            {data.recentActivity.length === 0 ? (
              <p className={styles.dim}>No rows.</p>
            ) : (
              <table className={`${styles.reportTable} ${styles.reportTableFixed}`}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.nowrap}>{formatActivityTime(item.timeIso)}</td>
                      <td className={styles.nowrap}>{item.title}</td>
                      <td className={styles.cellClamp}>{item.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
