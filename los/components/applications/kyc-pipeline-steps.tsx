'use client';

import type { LosApplicationDetails } from '@/lib/api';
import { buildKycPipelineSteps, type KycPipelineStepTone } from '@/lib/kyc-pipeline-steps';

const toneStyles: Record<KycPipelineStepTone, { summary: string; badge: string }> = {
  ok: { summary: 'var(--ok, #15803d)', badge: 'rgba(22, 163, 74, 0.12)' },
  warn: { summary: 'var(--bad, #b91c1c)', badge: 'rgba(185, 28, 28, 0.1)' },
  pending: { summary: '#92400e', badge: 'rgba(245, 158, 11, 0.14)' },
  neutral: { summary: 'var(--ink-2, #475569)', badge: 'rgba(148, 163, 184, 0.16)' },
};

export function KycPipelineSteps({
  row,
  variant = 'review',
}: {
  row: LosApplicationDetails;
  variant?: 'review' | 'overview';
}) {
  const steps = buildKycPipelineSteps(row);
  const compact = variant === 'overview';

  return (
    <ol
      className="kyc-pipeline-steps"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gap: compact ? 10 : 12,
      }}
    >
      {steps.map((step, index) => {
        const colors = toneStyles[step.tone];
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.id}
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? '28px 1fr' : '32px 1fr',
              gap: compact ? 10 : 12,
              position: 'relative',
            }}
          >
            {!isLast ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: compact ? 13 : 15,
                  top: compact ? 28 : 32,
                  bottom: compact ? -10 : -12,
                  width: 2,
                  background: 'rgba(148, 163, 184, 0.35)',
                }}
              />
            ) : null}
            <span
              aria-hidden
              style={{
                width: compact ? 28 : 32,
                height: compact ? 28 : 32,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? '0.72rem' : '0.76rem',
                fontWeight: 800,
                color: colors.summary,
                background: colors.badge,
                border: '1px solid rgba(148, 163, 184, 0.25)',
                zIndex: 1,
              }}
            >
              {step.stepNumber}
            </span>
            <div style={{ minWidth: 0, paddingBottom: isLast ? 0 : 2 }}>
              <div
                style={{
                  fontSize: compact ? '0.68rem' : '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3, #64748b)',
                  marginBottom: 4,
                }}
              >
                {step.label}
              </div>
              <div
                style={{
                  fontSize: compact ? '0.84rem' : '0.88rem',
                  fontWeight: 700,
                  color: colors.summary,
                  lineHeight: 1.4,
                }}
              >
                {step.summary}
              </div>
              {step.sub ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: compact ? '0.78rem' : '0.8rem',
                    lineHeight: 1.45,
                    color: 'var(--ink-3, #64748b)',
                  }}
                >
                  {step.sub}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
