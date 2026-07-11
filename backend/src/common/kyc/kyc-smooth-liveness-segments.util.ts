import type { ExpressionFrameMetric } from './kyc-face-expression.util';

export type SmoothLivenessSegmentPhase = 'baseline' | 'turn' | 'smile';

export type SmoothLivenessSegment = {
  phase: SmoothLivenessSegmentPhase;
  count: number;
};

/** Matches customer `active-liveness-capture.tsx` burst layout. */
export const DEFAULT_SMOOTH_LIVENESS_SEGMENTS: SmoothLivenessSegment[] = [
  { phase: 'baseline', count: 4 },
  { phase: 'turn', count: 12 },
  { phase: 'smile', count: 12 },
];

const VALID_PHASES = new Set<SmoothLivenessSegmentPhase>(['baseline', 'turn', 'smile']);

export function parseSmoothLivenessSegments(raw: unknown): SmoothLivenessSegment[] | null {
  if (!Array.isArray(raw)) return null;
  const segments: SmoothLivenessSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const phase = row.phase;
    const count = Number(row.count);
    if (
      typeof phase !== 'string' ||
      !VALID_PHASES.has(phase as SmoothLivenessSegmentPhase) ||
      !Number.isFinite(count) ||
      count < 1
    ) {
      return null;
    }
    segments.push({ phase: phase as SmoothLivenessSegmentPhase, count: Math.round(count) });
  }
  return segments.length ? segments : null;
}

export function smoothSegmentFrameTotal(segments: SmoothLivenessSegment[]): number {
  return segments.reduce((sum, seg) => sum + seg.count, 0);
}

/** Use explicit segments when they match frame count; else default layout when it fits. */
export function resolveSmoothLivenessSegments(
  frameCount: number,
  segments?: SmoothLivenessSegment[] | null,
): SmoothLivenessSegment[] | null {
  if (segments?.length && smoothSegmentFrameTotal(segments) === frameCount) {
    return segments;
  }
  if (smoothSegmentFrameTotal(DEFAULT_SMOOTH_LIVENESS_SEGMENTS) === frameCount) {
    return DEFAULT_SMOOTH_LIVENESS_SEGMENTS;
  }
  return null;
}

export function sliceSmoothLivenessFrames(
  frames: ExpressionFrameMetric[],
  segments: SmoothLivenessSegment[],
  phase: SmoothLivenessSegmentPhase,
): ExpressionFrameMetric[] {
  let offset = 0;
  for (const seg of segments) {
    if (seg.phase === phase) {
      return frames.slice(offset, offset + seg.count);
    }
    offset += seg.count;
  }
  return [];
}
