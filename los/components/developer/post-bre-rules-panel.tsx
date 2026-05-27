'use client';

import {
  fetchPostBreRulesCatalog,
  type PostBreCriteriaConfigRow,
  type PostBreRuleCatalogEntry,
  type PostBreRulesCatalogResult,
} from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

const CATEGORY_LABELS: Record<PostBreRuleCatalogEntry['category'], string> = {
  score: 'Bureau score',
  tradeline: 'Tradeline',
  enquiry: 'Enquiry',
  dpd: 'DPD / delinquency',
  diagnostic: 'Diagnostic',
};

function CriteriaTable({ rows }: { rows: PostBreCriteriaConfigRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[rgba(23,44,113,0.1)]">
      <table className="w-full min-w-[720px] border-collapse text-left text-[0.78rem]">
        <thead>
          <tr className="bg-[rgba(248,250,255,0.95)] text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
            <th className="px-3 py-2.5">Key</th>
            <th className="px-3 py-2.5">Label</th>
            <th className="px-3 py-2.5">Current value</th>
            <th className="px-3 py-2.5">Active</th>
            <th className="px-3 py-2.5">Used by rules</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-[rgba(23,44,113,0.06)]">
              <td className="px-3 py-2.5 font-mono font-semibold text-brand-navy">{row.key}</td>
              <td className="px-3 py-2.5">
                <p className="m-0 font-semibold text-brand-navy">{row.label}</p>
                {row.description ? (
                  <p className="m-0 mt-0.5 text-[0.72rem] leading-[1.4] text-brand-muted">{row.description}</p>
                ) : null}
              </td>
              <td className="px-3 py-2.5 font-mono font-bold text-brand-navy">{row.value}</td>
              <td className="px-3 py-2.5">
                <span
                  className={cx(
                    'inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold',
                    row.ruleEnabled
                      ? 'bg-[rgba(34,197,94,0.12)] text-[#166534]'
                      : 'bg-[rgba(148,163,184,0.2)] text-brand-muted',
                  )}
                >
                  {row.ruleEnabled ? 'Yes' : 'Off'}
                </span>
              </td>
              <td className="px-3 py-2.5 font-mono text-[0.72rem] text-brand-text">
                {row.appliesToCheckIds.length ? row.appliesToCheckIds.join(', ') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleCard({ rule, criteriaByKey }: { rule: PostBreRuleCatalogEntry; criteriaByKey: Map<string, PostBreCriteriaConfigRow> }) {
  const evaluated =
    rule.alwaysEvaluated ||
    (rule.toggleCriteriaKey ? criteriaByKey.get(rule.toggleCriteriaKey)?.ruleEnabled : true);

  return (
    <article className="rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white p-4 shadow-[0_4px_16px_rgba(23,44,113,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="m-0 text-[0.95rem] font-extrabold text-brand-navy">{rule.label}</h3>
          <p className="m-0 mt-0.5 font-mono text-[0.68rem] text-brand-muted">{rule.id}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex rounded-full bg-[rgba(139,92,246,0.1)] px-2 py-0.5 text-[0.68rem] font-extrabold text-[#5b21b6]">
            {CATEGORY_LABELS[rule.category]}
          </span>
          {rule.informationalOnly ? (
            <span className="inline-flex rounded-full bg-[rgba(20,150,243,0.1)] px-2 py-0.5 text-[0.68rem] font-extrabold text-brand-blue">
              Info only
            </span>
          ) : null}
          <span
            className={cx(
              'inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold',
              evaluated ? 'bg-[rgba(34,197,94,0.12)] text-[#166534]' : 'bg-[rgba(148,163,184,0.15)] text-brand-muted',
            )}
          >
            {evaluated ? 'Evaluated' : 'Skipped'}
          </span>
        </div>
      </div>

      <dl className="m-0 mt-3 grid gap-2 text-[0.8rem]">
        <div>
          <dt className="font-bold text-brand-muted">Fail when</dt>
          <dd className="m-0 mt-0.5 leading-[1.45] text-brand-text">{rule.condition}</dd>
        </div>
        <div>
          <dt className="font-bold text-brand-muted">Pass when</dt>
          <dd className="m-0 mt-0.5 leading-[1.45] text-brand-text">{rule.passCondition}</dd>
        </div>
        {rule.criteriaKeys.length ? (
          <div>
            <dt className="font-bold text-brand-muted">Eligibility keys</dt>
            <dd className="m-0 mt-0.5 font-mono text-brand-navy">{rule.criteriaKeys.join(', ')}</dd>
          </div>
        ) : null}
        {rule.toggleCriteriaKey ? (
          <div>
            <dt className="font-bold text-brand-muted">Toggle key</dt>
            <dd className="m-0 mt-0.5 font-mono text-brand-navy">{rule.toggleCriteriaKey}</dd>
          </div>
        ) : null}
        {rule.rejectionReasonCode ? (
          <div>
            <dt className="font-bold text-brand-muted">Rejection code</dt>
            <dd className="m-0 mt-0.5 font-mono text-brand-navy">{rule.rejectionReasonCode}</dd>
          </div>
        ) : null}
        {rule.tuefReference ? (
          <div>
            <dt className="font-bold text-brand-muted">TUEF / CIBIL reference</dt>
            <dd className="m-0 mt-0.5 text-brand-text">{rule.tuefReference}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-bold text-brand-muted">Data sources</dt>
          <dd className="m-0 mt-0.5">
            <ul className="m-0 list-inside list-disc pl-0 text-brand-text">
              {rule.dataSources.map((src) => (
                <li key={src} className="leading-[1.45]">
                  {src}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        {rule.notes ? (
          <div>
            <dt className="font-bold text-brand-muted">Notes</dt>
            <dd className="m-0 mt-0.5 leading-[1.45] text-brand-muted">{rule.notes}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function CatalogContent({ data }: { data: PostBreRulesCatalogResult }) {
  const criteriaByKey = new Map(data.criteria.map((c) => [c.key, c]));
  const blockingCount = data.rules.filter((r) => !r.informationalOnly && (r.alwaysEvaluated || (r.toggleCriteriaKey && criteriaByKey.get(r.toggleCriteriaKey)?.ruleEnabled))).length;

  return (
    <div className="grid gap-6">
      <div className="rounded-[14px] border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.06)] px-4 py-3">
        <p className="m-0 text-[0.84rem] leading-[1.5] text-brand-text">
          Reference for all rules run <strong>after</strong> bureau pull. Values below are loaded live from{' '}
          <code className="text-[0.8rem]">eligibility_criteria</code>. To test a bureau file against these rules, use{' '}
          <Link href="/developer-tools/post-bureau-check" className="font-bold text-brand-blue underline">
            Post BRE Inspector
          </Link>
          .
        </p>
        <p className="m-0 mt-2 text-[0.8rem] text-brand-muted">
          Enquiry rolling window: <strong className="text-brand-navy">{data.enquiryWindowDays} days</strong> · Blocking
          rules when enabled: <strong className="text-brand-navy">{blockingCount}</strong>
        </p>
      </div>

      <section className="grid gap-3">
        <h2 className="m-0 text-[1rem] font-extrabold tracking-[-0.03em] text-brand-navy">
          Eligibility criteria keys
        </h2>
        <CriteriaTable rows={data.criteria} />
        <p className="m-0 text-[0.78rem] text-brand-muted">
          Edit values in{' '}
          <Link href="/eligibility-criteria/profile-eligibility-check" className="font-semibold text-brand-blue underline">
            Profile Eligibility Check
          </Link>
          .
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="m-0 text-[1rem] font-extrabold tracking-[-0.03em] text-brand-navy">Post-BRE rules</h2>
        <div className="grid gap-3">
          {data.rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} criteriaByKey={criteriaByKey} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function PostBreRulesPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PostBreRulesCatalogResult | null>(null);

  useEffect(() => {
    const token = getLosToken();
    if (!token) {
      setError('Session expired. Sign in again.');
      setLoading(false);
      return;
    }

    void fetchPostBreRulesCatalog(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load catalog.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="m-0 rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-white p-6 text-center text-[0.88rem] text-brand-muted">
        Loading post-BRE rules…
      </p>
    );
  }

  if (error) {
    return (
      <p className="m-0 rounded-[10px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-[0.84rem] text-[#991b1b]">
        {error}
      </p>
    );
  }

  if (!data) return null;

  return <CatalogContent data={data} />;
}
