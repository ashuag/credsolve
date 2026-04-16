import Link from 'next/link';
import {CrmShell} from '@/components/layout/crm-shell';
import styles from '@/app/dashboard/dashboard.module.css';
import { getDashboard } from '@/lib/api';

function money(value: number) {
    return `INR ${value.toLocaleString('en-IN')}`;
}

function percent(value: number, total: number) {
    if (!total) return 0;
    return Math.round((value / total) * 100);
}

export default async function CrmDashboardPage() {
    const dashboard = await getDashboard();
    const leadPipeline = [
        {label: 'Fresh leads', total: 34, focusLabel: 'High intent', focusValue: 12},
        {label: 'KYC and bureau', total: 16, focusLabel: 'Docs pending', focusValue: 6},
        {label: 'Sanctioned', total: 11, focusLabel: 'E-sign due', focusValue: 4},
        {label: 'Disbursed', total: 7, focusLabel: 'Repayment due in 7d', focusValue: 3}
    ];

    const totalLeadFlow = leadPipeline.reduce((sum, item) => sum + item.total, 0);
    const sanctionedToday = 2400000;
    const disbursedToday = 1800000;
    const paymentsReceivedToday = 486000;
    const activeAgents = dashboard.activeAgentsToday;
    const averageTicketSize = 145000;
    const emiDueToday = 19;
    const medianTatHours = 3.2;
    const approvalRate = 74;
    const sameDayDisbursal = 68;
    const collectionEfficiency = 92;

    const operationalSignals = [
        {
            label: 'Approval quality',
            value: `${approvalRate}%`,
            detail: '19 of 26 underwritten files cleared without policy deviation or manual escalation.',
            progress: approvalRate
        },
        {
            label: 'Same-day disbursal',
            value: `${sameDayDisbursal}%`,
            detail: '7 of 11 sanctioned borrowers received payout on the same business day.',
            progress: sameDayDisbursal
        },
        {
            label: 'Collection efficiency',
            value: `${collectionEfficiency}%`,
            detail: 'Receipt reconciliation is stable, with ACH and UPI collections clearing before noon.',
            progress: collectionEfficiency
        }
    ];

    const priorityQueue = [
        {
            title: 'Push salaried repeat borrowers first',
            value: '14 ready',
            text: 'These leads already have prior repayment history. Fast underwriting here improves disbursal volume without widening risk.'
        },
        {
            title: 'Clear merchant bank-statement exceptions',
            value: '6 files',
            text: 'Inventory and working-capital cases are getting delayed on parser mismatches. This is the cleanest queue to unblock.'
        },
        {
            title: 'Watch first EMI slippage',
            value: '5 alerts',
            text: 'Borrowers entering first-cycle repayment need active follow-up before minor delay turns into a collections issue.'
        }
    ];

    const nextActions = [
        {
            title: 'Tighten bureau-to-sanction turnaround',
            text: 'Move green-score borrowers from bureau clear to sanction within one review cycle to protect same-day payout capacity.'
        },
        {
            title: 'Escalate disbursal-ready but unsigned files',
            text: 'Borrowers waiting on e-sign or mandate setup should get same-hour outreach from the sales and ops desk.'
        },
        {
            title: 'Pre-call D1 repayment cohort',
            text: 'Use the morning queue to confirm mandate success and reduce avoidable bounce or reminder traffic later in the day.'
        }
    ];

    const recentActivity = [
        {id: 'a1', title: 'New lead assigned', actor: 'Riya Shah routed a fresh salaried borrower from the DSA channel.', time: 'Today, 11:24'},
        {id: 'a2', title: 'KYC cleared', actor: 'Aadhaar, PAN, and selfie match completed for borrower MC-STL-2084.', time: 'Today, 11:06'},
        {id: 'a3', title: 'Loan sanctioned', actor: 'Credit desk approved INR 250,000 working-capital file for Lotus Hardware.', time: 'Today, 10:41'},
        {id: 'a4', title: 'Loan disbursed', actor: 'Ops released INR 180,000 after e-sign and bank verification closure.', time: 'Today, 10:18'},
        {id: 'a5', title: 'Payment received', actor: 'ACH debit posted for borrower MC-STL-1970 and ledger matched automatically.', time: 'Today, 09:52'}
    ];

    return (
        <CrmShell
            title="MoneyCash Short-Term Loan LOS"
            subtitle="A live operating surface for lead intake, underwriting, sanctions, disbursals, and repayment visibility across the NBFC desk."
            showPageHead={false}
        >
            <div className={styles.dashboard}>
                <section className={styles.heroGrid}>
                    <article className={styles.heroCard}>
                        <span className={styles.eyebrow}>Today&apos;s command view</span>
                        <h2 className={styles.heroTitle}>Source fast, underwrite clean, and disburse before the queue cools.</h2>
                        <p className={styles.heroCopy}>
                            The LOS is tuned for short-term NBFC lending: keep fresh leads moving into KYC, turn low-friction files into sanctions,
                            and release cash quickly without losing sight of repayment quality.
                        </p>

                        <div className={styles.heroMetricGrid}>
                            <div className={styles.heroMetric}>
                                <span className={styles.heroMetricLabel}>Sanctioned today</span>
                                <strong className={styles.heroMetricValue}>{money(sanctionedToday)}</strong>
                                <p className={styles.heroMetricText}>Approved loan value waiting for acceptance, e-sign, and disbursal release.</p>
                            </div>
                            <div className={styles.heroMetric}>
                                <span className={styles.heroMetricLabel}>Disbursed today</span>
                                <strong className={styles.heroMetricValue}>{money(disbursedToday)}</strong>
                                <p className={styles.heroMetricText}>Same-day cash release across salaried and merchant short-term loans.</p>
                            </div>
                            <div className={styles.heroMetric}>
                                <span className={styles.heroMetricLabel}>Payments received</span>
                                <strong className={styles.heroMetricValue}>{money(paymentsReceivedToday)}</strong>
                                <p className={styles.heroMetricText}>Collections posted through ACH, UPI, and bank transfer reconciliations.</p>
                            </div>
                        </div>
                    </article>

                    <aside className={styles.priorityCard}>
                        <div className={styles.panelHead}>
                            <div>
                                <span className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Priority queue</span>
                                <h2 className={styles.panelTitle}>What the LOS team should clear next</h2>
                            </div>
                        </div>

                        <div className={styles.priorityList}>
                            {priorityQueue.map((item, index) => (
                                <article key={item.title} className={styles.priorityItem}>
                                    <div className={styles.priorityTop}>
                                        <strong>{item.title}</strong>
                                        <span className={`${styles.pill} ${index === 0 ? styles.pillGold : index === 2 ? styles.pillSuccess : ''}`}>
                                            {item.value}
                                        </span>
                                    </div>
                                    <p>{item.text}</p>
                                </article>
                            ))}
                        </div>
                    </aside>
                </section>

                <section className={styles.statGrid}>
                    <Link
                        href="/agents"
                        className={`${styles.statCard} block no-underline transition-transform duration-150 hover:-translate-y-px`}
                        aria-label="Go to agents page"
                    >
                        <span className={styles.statLabel}>Active agents today</span>
                        <strong className={styles.statValue}>{activeAgents}</strong>
                        <p className={styles.statText}>Sales, credit, ops, and collections heads currently moving the short-term-loan book.</p>
                    </Link>
                    <article className={styles.statCard}>
                        <span className={styles.statLabel}>Average ticket size</span>
                        <strong className={styles.statValue}>{money(averageTicketSize)}</strong>
                        <p className={styles.statText}>Current mix is centered on compact, fast-turn working-capital and salaried cash-flow loans.</p>
                    </article>
                    <article className={styles.statCard}>
                        <span className={styles.statLabel}>Median TAT</span>
                        <strong className={styles.statValue}>{medianTatHours} hrs</strong>
                        <p className={styles.statText}>Median time from fresh lead to sanction decision for policy-fit borrowers.</p>
                    </article>
                    <article className={styles.statCard}>
                        <span className={styles.statLabel}>EMIs due today</span>
                        <strong className={styles.statValue}>{emiDueToday}</strong>
                        <p className={styles.statText}>Use early outreach to hold bounce rates down and protect first-cycle repayment quality.</p>
                    </article>
                </section>

                <section className={styles.boardGrid}>
                    <article className={styles.panel}>
                        <div className={styles.panelHead}>
                            <div>
                                <span className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Lead funnel</span>
                                <h2 className={styles.panelTitle}>Where the day&apos;s volume sits right now</h2>
                                <p className={styles.panelCopy}>Each bucket shows current queue size, what needs attention, and its share of total active files.</p>
                            </div>
                        </div>

                        <div className={styles.pipelineGrid}>
                            {leadPipeline.map((item) => (
                                <article key={item.label} className={styles.pipelineCard}>
                                    <span className={styles.pipelineLabel}>{item.label}</span>
                                    <strong className={styles.pipelineTotal}>{item.total}</strong>
                                    <div className={styles.pipelineFoot}>
                                        <span>{item.focusLabel}: {item.focusValue}</span>
                                        <span>{percent(item.total, totalLeadFlow)}% share</span>
                                    </div>
                                    <div className={styles.progressTrack} aria-hidden>
                                        <div className={styles.progressBar} style={{width: `${percent(item.total, totalLeadFlow)}%`}}/>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </article>

                    <article className={styles.panel}>
                        <div className={styles.panelHead}>
                            <div>
                                <span className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Credit and collection signals</span>
                                <h2 className={styles.panelTitle}>Momentum radar</h2>
                                <p className={styles.panelCopy}>Fast LOS execution matters only when approval quality and repayment readiness stay intact.</p>
                            </div>
                        </div>

                        <div className={styles.signalList}>
                            {operationalSignals.map((item) => (
                                <article key={item.label} className={styles.signalItem}>
                                    <div className={styles.signalTop}>
                                        <strong>{item.label}</strong>
                                        <span className={styles.pill}>{item.progress}%</span>
                                    </div>
                                    <strong className={styles.signalValue}>{item.value}</strong>
                                    <p>{item.detail}</p>
                                    <div className={styles.signalTrack} aria-hidden>
                                        <div className={styles.signalBar} style={{width: `${item.progress}%`}}/>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </article>
                </section>

                <section className={styles.lowerGrid}>
                    <article className={styles.timelinePanel}>
                        <div className={styles.panelHead}>
                            <div>
                                <span className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Recent operator feed</span>
                                <h2 className={styles.panelTitle}>Latest desk activity</h2>
                                <p className={styles.panelCopy}>A dummy snapshot of what sourcing, credit, ops, and collections are touching right now.</p>
                            </div>
                        </div>

                        <div className={styles.timelineList}>
                            {recentActivity.map((item) => (
                                <article key={item.id} className={styles.timelineItem}>
                                    <div className={styles.timelineTop}>
                                        <strong>{item.title}</strong>
                                        <span className={styles.timelineMeta}>{item.time}</span>
                                    </div>
                                    <p>{item.actor}</p>
                                </article>
                            ))}
                        </div>
                    </article>

                    <aside className={styles.actionPanel}>
                        <div className={styles.panelHead}>
                            <div>
                                <span className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Next actions</span>
                                <h2 className={styles.panelTitle}>Desk playbook</h2>
                                <p className={styles.panelCopy}>Three actions to keep a short-term-loan LOS fast without making credit or collections sloppy.</p>
                            </div>
                        </div>

                        <div className={styles.actionList}>
                            {nextActions.map((item) => (
                                <article key={item.title} className={styles.actionItem}>
                                    <div className={styles.actionTop}>
                                        <strong>{item.title}</strong>
                                        <span className={`${styles.pill} ${styles.pillGold}`}>Action</span>
                                    </div>
                                    <p>{item.text}</p>
                                </article>
                            ))}
                        </div>
                    </aside>
                </section>
            </div>
        </CrmShell>
    );
}
