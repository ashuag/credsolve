'use client';

import type { LosCrmDashboardDailyPoint } from '@/lib/api';
import styles from '@/app/dashboard/dashboard.module.css';

function tickLabelUtc(iso: string) {
  const parts = iso.split('-');
  const d = parts[2] ?? '';
  const m = parts[1] ?? '';
  return `${d}/${m}`;
}

function formatInrShort(s: string | null) {
  if (s == null || s === '') return '';
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

type Props = {
  series: LosCrmDashboardDailyPoint[];
};

export function DashboardDailyCharts({ series }: Props) {
  if (!series.length) return null;

  const maxIntake = Math.max(1, ...series.flatMap((p) => [p.newLeads, p.newApplications]));
  const maxDisb = Math.max(1, ...series.map((p) => p.disbursedCount));

  return (
    <section className={styles.chartRow} aria-label="Daily trends UTC">
      <div className={styles.chartPanel}>
        <h2 className={styles.chartTitle}>New leads & applications</h2>
        <p className={styles.chartSub}>Last {series.length} UTC days · bar height ∝ count</p>
        <div className={styles.chartLegend}>
          <span className={styles.chartLegItem}>
            <span className={styles.chartSwatchLead} aria-hidden /> Leads
          </span>
          <span className={styles.chartLegItem}>
            <span className={styles.chartSwatchApp} aria-hidden /> Applications
          </span>
        </div>
        <div className={styles.chartBars} role="img" aria-label="Daily new leads and applications">
          {series.map((row) => (
            <div key={row.date} className={styles.chartCol}>
              <div className={styles.chartPair}>
                <div
                  className={styles.barLead}
                  style={{ height: `${(row.newLeads / maxIntake) * 100}%` }}
                  title={`${row.date} UTC — leads: ${row.newLeads}`}
                />
                <div
                  className={styles.barApp}
                  style={{ height: `${(row.newApplications / maxIntake) * 100}%` }}
                  title={`${row.date} UTC — applications: ${row.newApplications}`}
                />
              </div>
              <span className={styles.chartTick}>{tickLabelUtc(row.date)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chartPanel}>
        <h2 className={styles.chartTitle}>Disbursements</h2>
        <p className={styles.chartSub}>Count per UTC day · hover for amount</p>
        <div className={styles.chartBars} role="img" aria-label="Daily disbursement count">
          {series.map((row) => (
            <div key={row.date} className={styles.chartCol}>
              <div className={styles.chartSingleWrap}>
                <div
                  className={styles.barDisb}
                  style={{ height: `${(row.disbursedCount / maxDisb) * 100}%` }}
                  title={`${row.date} UTC — ${row.disbursedCount} payout(s), ${formatInrShort(row.disbursedAmountInr) || '₹0'}`}
                />
              </div>
              <span className={styles.chartTick}>{tickLabelUtc(row.date)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
