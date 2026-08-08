'use client';

import type { KycFaceMatchLocalResult } from '@/lib/api/kyc-face-match-check';
import { cx } from '@/lib/cx';

/** Generic result card shape used by the face-match developer tool. */
export type FaceMatchResultCard = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  vendorErrorMessage?: string;
  businessOk: boolean;
  summary?: Record<string, unknown>;
};

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value > 1) return `${value.toFixed(1)}%`;
  return `${(value * 100).toFixed(1)}%`;
}

function formatBool(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

export function KycTenacioVendorResult({
  result,
  passLabel,
  failLabel,
  skipLabel = 'Check skipped',
  extraRows,
  sectionTitle = 'Result',
  rawJsonLabel = 'Raw JSON',
  showHttpRows = true,
}: {
  result: FaceMatchResultCard;
  passLabel: string;
  failLabel: string;
  skipLabel?: string;
  extraRows?: Array<{ label: string; value: string; tone?: 'ok' | 'bad' | 'default' }>;
  sectionTitle?: string;
  rawJsonLabel?: string;
  showHttpRows?: boolean;
}) {
  const skipped = !result.configured;
  const passed = skipped ? true : result.businessOk;
  const headline = skipped ? skipLabel : passed ? passLabel : failLabel;

  return (
    <div
      className={cx(
        'rounded-[14px] border px-4 py-4',
        skipped
          ? 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.06)]'
          : passed
            ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)]'
            : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)]',
      )}
    >
      <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">{sectionTitle}</p>
      <p className="m-0 mt-1 text-[1.15rem] font-extrabold text-brand-navy">{headline}</p>

      {skipped && result.skipReason ? (
        <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-[#92400e]">{result.skipReason}</p>
      ) : null}

      {!skipped && result.vendorErrorMessage && !passed ? (
        <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-brand-text">{result.vendorErrorMessage}</p>
      ) : null}

      <dl className="m-0 mt-4 grid gap-2 text-[0.82rem] text-brand-text">
        {showHttpRows ? (
          <>
            <div className="grid grid-cols-[minmax(0,0.42fr)_1fr] gap-2">
              <dt className="text-brand-muted">HTTP status</dt>
              <dd className="m-0 font-mono">{result.httpStatus ?? '—'}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.42fr)_1fr] gap-2">
              <dt className="text-brand-muted">Check status</dt>
              <dd className="m-0 font-mono">{result.ok ? 'OK' : 'Failed'}</dd>
            </div>
          </>
        ) : null}
        {extraRows?.map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(0,0.42fr)_1fr] gap-2">
            <dt className="text-brand-muted">{row.label}</dt>
            <dd
              className={cx(
                'm-0 font-mono font-semibold',
                row.tone === 'ok' ? 'text-[#166534]' : row.tone === 'bad' ? 'text-[#991b1b]' : '',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <details className="mt-4">
        <summary className="cursor-pointer text-[0.82rem] font-bold text-brand-navy">{rawJsonLabel}</summary>
        <pre className="mt-2 overflow-x-auto text-[0.75rem] text-brand-muted">
          {JSON.stringify(result.vendor, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function buildLocalFaceMatchExtraRows(local: KycFaceMatchLocalResult) {
  return [
    {
      label: 'Reference face detected',
      value: formatBool(local.reference.faceDetected),
      tone: local.reference.faceDetected ? ('ok' as const) : ('bad' as const),
    },
    {
      label: 'Probe face detected',
      value: formatBool(local.probe.faceDetected),
      tone: local.probe.faceDetected ? ('ok' as const) : ('bad' as const),
    },
    {
      label: 'Reference dual face',
      value:
        local.reference.dualFaceDetected == null
          ? '—'
          : local.reference.dualFaceDetected
            ? `Fail (${local.reference.faceCount ?? '?'} faces)`
            : 'Pass',
      tone:
        local.reference.dualFaceDetected === true
          ? ('bad' as const)
          : local.reference.dualFaceDetected === false
            ? ('ok' as const)
            : undefined,
    },
    {
      label: 'Probe dual face',
      value:
        local.probe.dualFaceDetected == null
          ? '—'
          : local.probe.dualFaceDetected
            ? `Fail (${local.probe.faceCount ?? '?'} faces)`
            : 'Pass',
      tone:
        local.probe.dualFaceDetected === true
          ? ('bad' as const)
          : local.probe.dualFaceDetected === false
            ? ('ok' as const)
            : undefined,
    },
    {
      label: 'Reference detection score',
      value: formatScore(local.reference.detectionScore),
    },
    {
      label: 'Probe detection score',
      value: formatScore(local.probe.detectionScore),
    },
    {
      label: 'Match score',
      value: formatScore(local.matchScore),
      tone: local.matchPassed ? ('ok' as const) : ('bad' as const),
    },
    {
      label: 'Descriptor distance',
      value: local.distance == null ? '—' : local.distance.toFixed(4),
    },
    {
      label: 'Max distance threshold',
      value: local.maxDistanceThreshold.toFixed(2),
    },
    {
      label: 'Faces match',
      value: formatBool(local.matchPassed),
      tone: local.matchPassed ? ('ok' as const) : ('bad' as const),
    },
  ];
}
