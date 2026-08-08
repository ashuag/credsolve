import {
  extractLivenessIsLive,
  extractLivenessScore,
} from './aadhaar-vendor-parse.util';

export type LivenessVendorSummary = {
  passed: boolean;
  checkedAt: string | null;
  vendorScore: number | null;
  isLive: boolean | null;
  vendorStatus: string | null;
  /** MoneyCash active liveness (head movement) — see `kyc-head-movement.util.ts`. */
  mode: 'smooth' | 'challenge' | null;
  activeLivenessPassed: boolean | null;
  activeLivenessReason: string | null;
  headMovementScore: number | null;
  headMovementMinScoreRequired: number | null;
  headMovementDirections: string[] | null;
  headTurnLeftDetected: boolean | null;
  headTurnRightDetected: boolean | null;
  headTiltUpDetected: boolean | null;
  headTiltDownDetected: boolean | null;
  blinkDetected: boolean | null;
  smileDetected: boolean | null;
  expressionAntiSpoofPassed: boolean | null;
  expressionAntiSpoofReason: string | null;
  framesWithFace: number | null;
  framesAnalyzed: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((v): v is string => typeof v === 'string');
  return items.length ? items : null;
}

const EMPTY_ACTIVE_LIVENESS: Pick<
  LivenessVendorSummary,
  | 'mode'
  | 'activeLivenessPassed'
  | 'activeLivenessReason'
  | 'headMovementScore'
  | 'headMovementMinScoreRequired'
  | 'headMovementDirections'
  | 'headTurnLeftDetected'
  | 'headTurnRightDetected'
  | 'headTiltUpDetected'
  | 'headTiltDownDetected'
  | 'blinkDetected'
  | 'smileDetected'
  | 'expressionAntiSpoofPassed'
  | 'expressionAntiSpoofReason'
  | 'framesWithFace'
  | 'framesAnalyzed'
> = {
  mode: null,
  activeLivenessPassed: null,
  activeLivenessReason: null,
  headMovementScore: null,
  headMovementMinScoreRequired: null,
  headMovementDirections: null,
  headTurnLeftDetected: null,
  headTurnRightDetected: null,
  headTiltUpDetected: null,
  headTiltDownDetected: null,
  blinkDetected: null,
  smileDetected: null,
  expressionAntiSpoofPassed: null,
  expressionAntiSpoofReason: null,
  framesWithFace: null,
  framesAnalyzed: null,
};

/** Reads the `activeLiveness` block written by `POST applications/kyc/liveness-video`. */
function extractActiveLiveness(vendor: unknown): typeof EMPTY_ACTIVE_LIVENESS {
  const root = asRecord(vendor);
  const block = asRecord(root?.activeLiveness);
  if (!block) return EMPTY_ACTIVE_LIVENESS;

  const aggregates = asRecord(block.aggregates) ?? {};
  const rawMode = asTrimmedString(block.mode);
  const expression = asRecord(block.expressionAntiSpoof) ?? {};

  return {
    mode: rawMode === 'smooth' || rawMode === 'challenge' ? rawMode : null,
    activeLivenessPassed: asBoolean(block.passed),
    activeLivenessReason: asTrimmedString(block.reason),
    headMovementScore: asNumber(block.headMovementScore),
    headMovementMinScoreRequired: asNumber(block.minScoreRequired),
    headMovementDirections: asStringArray(aggregates.directions),
    headTurnLeftDetected: asBoolean(aggregates.headTurnLeftDetected),
    headTurnRightDetected: asBoolean(aggregates.headTurnRightDetected),
    headTiltUpDetected: asBoolean(aggregates.headTiltUpDetected),
    headTiltDownDetected: asBoolean(aggregates.headTiltDownDetected),
    blinkDetected: asBoolean(aggregates.blinkDetected),
    smileDetected: asBoolean(aggregates.smileDetected),
    expressionAntiSpoofPassed:
      asBoolean(aggregates.expressionAntiSpoofPassed) ?? asBoolean(expression.passed),
    expressionAntiSpoofReason:
      asTrimmedString(aggregates.expressionAntiSpoofReason) ?? asTrimmedString(expression.reason),
    framesWithFace: asNumber(aggregates.framesWithFace),
    framesAnalyzed: asNumber(aggregates.framesAnalyzed),
  };
}

export function buildLivenessVendorSummary(params: {
  passed: boolean;
  checkedAt: Date | null;
  vendor: unknown;
}): LivenessVendorSummary | null {
  if (!params.checkedAt && !params.vendor) return null;

  let vendorStatus: string | null = null;
  const v = asRecord(params.vendor);
  if (v) {
    if (v.localFaceCheck === true && (v.outboundSkipped === true || v.paused === true)) {
      vendorStatus = 'local-only';
    } else if (typeof v.status === 'string') vendorStatus = v.status;
    else if (typeof v.success === 'boolean') vendorStatus = v.success ? 'success' : 'failed';
  }

  return {
    passed: params.passed,
    checkedAt: params.checkedAt?.toISOString() ?? null,
    vendorScore: extractLivenessScore(params.vendor),
    isLive: extractLivenessIsLive(params.vendor),
    vendorStatus,
    ...extractActiveLiveness(params.vendor),
  };
}
