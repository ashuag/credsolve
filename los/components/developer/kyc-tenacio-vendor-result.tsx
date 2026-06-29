'use client';

import type { KycFaceMatchLocalResult, KycSelfieFaceLocalResult, LosTenacioDryRunResult } from '@/lib/api/kyc-tenacio-checks';
import { cx } from '@/lib/cx';

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
  skipLabel = 'Vendor check skipped',
  extraRows,
  sectionTitle = 'Result',
  rawJsonLabel = 'Raw vendor JSON',
  showHttpRows = true,
}: {
  result: LosTenacioDryRunResult;
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
              <dt className="text-brand-muted">Vendor transport</dt>
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

export function buildFaceMatchExtraRows(result: LosTenacioDryRunResult) {
  const s = result.summary as {
    matchScore?: number | null;
    matchPassed?: boolean | null;
    referenceSource?: { type: string; url?: string; storedAs?: string };
    probeSource?: { type: string; url?: string; storedAs?: string };
  };
  const formatSource = (src?: { type: string; url?: string; storedAs?: string }) => {
    if (!src) return '—';
    if (src.type === 'url' && src.url) return 'Direct URL';
    if (src.storedAs) return 'Uploaded JPEG';
    return src.type;
  };
  return [
    {
      label: 'Reference source',
      value: formatSource(s.referenceSource),
    },
    {
      label: 'Probe source',
      value: formatSource(s.probeSource),
    },
    {
      label: 'Tenacio match score',
      value: formatScore(s.matchScore),
      tone: s.matchPassed === true ? ('ok' as const) : s.matchPassed === false ? ('bad' as const) : undefined,
    },
    {
      label: 'Tenacio faces match',
      value: formatBool(s.matchPassed),
      tone: s.matchPassed === true ? ('ok' as const) : s.matchPassed === false ? ('bad' as const) : undefined,
    },
  ];
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
      label: 'Reference detection score',
      value: formatScore(local.reference.detectionScore),
    },
    {
      label: 'Probe detection score',
      value: formatScore(local.probe.detectionScore),
    },
    {
      label: 'Local match score',
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
      label: 'Local faces match',
      value: formatBool(local.matchPassed),
      tone: local.matchPassed ? ('ok' as const) : ('bad' as const),
    },
  ];
}

export function buildLocalSelfieFaceExtraRows(local: KycSelfieFaceLocalResult) {
  return [
    {
      label: 'Image',
      value: `${local.imageWidth}×${local.imageHeight}`,
    },
    {
      label: 'Computed confidence',
      value: formatScore(local.bestComputedConfidence),
      tone:
        local.bestComputedConfidence != null &&
        local.bestComputedConfidence >= local.minComputedConfidenceRequired
          ? ('ok' as const)
          : local.bestComputedConfidence != null
            ? ('bad' as const)
            : undefined,
    },
    {
      label: 'Blur check',
      value:
        local.blurPassed == null
          ? '—'
          : local.blurPassed
            ? `Pass (${local.laplacianVariance?.toFixed(1) ?? '—'})`
            : `Fail (${local.laplacianVariance?.toFixed(1) ?? '—'})`,
      tone: local.blurPassed === true ? ('ok' as const) : local.blurPassed === false ? ('bad' as const) : undefined,
    },
    {
      label: 'Detections',
      value: `${local.qualifyingDetectionCount} qualifying / ${local.rawDetectionCount} raw`,
    },
    {
      label: 'Local selfie validation',
      value: formatBool(local.ok),
      tone: local.ok ? ('ok' as const) : ('bad' as const),
    },
  ];
}

export function buildLivenessExtraRows(result: LosTenacioDryRunResult) {
  const s = result.summary;
  return [
    {
      label: 'Liveness score',
      value: formatScore(s.livenessScore),
    },
    {
      label: 'Is live',
      value: formatBool(s.isLive),
      tone: s.isLive === true ? ('ok' as const) : s.isLive === false ? ('bad' as const) : undefined,
    },
    {
      label: 'Multiple faces',
      value: formatBool(s.multipleFacesDetected),
      tone: s.multipleFacesDetected === true ? ('bad' as const) : s.multipleFacesDetected === false ? ('ok' as const) : undefined,
    },
    {
      label: 'Face occluded',
      value: formatBool(s.faceOccluded),
      tone: s.faceOccluded === true ? ('bad' as const) : s.faceOccluded === false ? ('ok' as const) : undefined,
    },
  ];
}
