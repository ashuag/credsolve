import {
  extractLivenessIsLive,
  extractLivenessScore,
} from './aadhaar-vendor-parse.util';

export type LivenessVendorSummary = {
  /** Overall pipeline liveness result (all MoneyCash checks). */
  passed: boolean;
  checkedAt: string | null;
  /** @deprecated Tenacio passive liveness — not used in the customer journey anymore. */
  vendorScore: number | null;
  /** @deprecated Tenacio passive liveness — not used in the customer journey anymore. */
  isLive: boolean | null;
  /** @deprecated Tenacio passive liveness — not used in the customer journey anymore. */
  vendorStatus: string | null;
  /** Active liveness capture mode (`smooth` = head-turn + smile session). */
  mode: 'smooth' | 'challenge' | null;
  /** Step 4 — on-server active liveness (head turns + smile). */
  activeLivenessPassed: boolean | null;
  activeLivenessReason: string | null;
  headTurnLeftDetected: boolean | null;
  headTurnRightDetected: boolean | null;
  /** @deprecated Legacy blink metric — not used in smooth head-turn mode. */
  blinkDetected: boolean | null;
  smileDetected: boolean | null;
  expressionAntiSpoofPassed: boolean | null;
  expressionAntiSpoofReason: string | null;
  framesWithFace: number | null;
  framesAnalyzed: number | null;
};

function readBool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseActiveLivenessChallenge(
  value: unknown,
): {
  challenge: string | null;
  passed: boolean | null;
  reason: string | null;
  aggregates: Record<string, unknown>;
  expressionAntiSpoof: {
    passed: boolean | null;
    reason: string | null;
  } | null;
  framesWithFace: number | null;
  framesAnalyzed: number | null;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const aggregates =
    row.aggregates && typeof row.aggregates === 'object' && !Array.isArray(row.aggregates)
      ? (row.aggregates as Record<string, unknown>)
      : {};

  let expressionAntiSpoof: { passed: boolean | null; reason: string | null } | null = null;
  if (row.expressionAntiSpoof && typeof row.expressionAntiSpoof === 'object') {
    const es = row.expressionAntiSpoof as Record<string, unknown>;
    expressionAntiSpoof = {
      passed: readBool(es.passed),
      reason: readString(es.reason),
    };
  }

  return {
    challenge: readString(row.challenge),
    passed: readBool(row.passed),
    reason: readString(row.reason),
    aggregates,
    expressionAntiSpoof,
    framesWithFace: readNumber(row.framesWithFace),
    framesAnalyzed: readNumber(row.framesAnalyzed),
  };
}

function extractActiveLivenessFromVendor(vendor: unknown): {
  mode: 'smooth' | 'challenge' | null;
  activeLivenessPassed: boolean | null;
  activeLivenessReason: string | null;
  headTurnLeftDetected: boolean | null;
  headTurnRightDetected: boolean | null;
  blinkDetected: boolean | null;
  smileDetected: boolean | null;
  expressionAntiSpoofPassed: boolean | null;
  expressionAntiSpoofReason: string | null;
  framesWithFace: number | null;
  framesAnalyzed: number | null;
} {
  const empty = {
    mode: null as 'smooth' | 'challenge' | null,
    activeLivenessPassed: null,
    activeLivenessReason: null,
    headTurnLeftDetected: null,
    headTurnRightDetected: null,
    blinkDetected: null,
    smileDetected: null,
    expressionAntiSpoofPassed: null,
    expressionAntiSpoofReason: null,
    framesWithFace: null,
    framesAnalyzed: null,
  };

  if (!vendor || typeof vendor !== 'object' || Array.isArray(vendor)) return empty;
  const root = vendor as Record<string, unknown>;
  const active = root.activeLiveness;
  const expressionRoot = root.expressionAntiSpoof;
  let expressionFromRoot: { passed: boolean | null; reason: string | null } | null = null;
  if (expressionRoot && typeof expressionRoot === 'object' && !Array.isArray(expressionRoot)) {
    const es = expressionRoot as Record<string, unknown>;
    expressionFromRoot = {
      passed: readBool(es.passed),
      reason: readString(es.reason),
    };
  }

  if (!active || typeof active !== 'object' || Array.isArray(active)) {
    if (!expressionFromRoot) return empty;
    return {
      ...empty,
      expressionAntiSpoofPassed: expressionFromRoot.passed,
      expressionAntiSpoofReason: expressionFromRoot.reason,
    };
  }

  const activeRow = active as Record<string, unknown>;
  const challenges = Array.isArray(activeRow.challenges) ? activeRow.challenges : [];
  const parsed = challenges
    .map((item) => parseActiveLivenessChallenge(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const smooth = parsed.find((item) => item.challenge === 'smooth') ?? parsed[0] ?? null;
  if (!smooth) {
    return {
      ...empty,
      activeLivenessPassed: readBool(activeRow.passed),
    };
  }

  const mode: 'smooth' | 'challenge' | null =
    smooth.challenge === 'smooth' ? 'smooth' : smooth.challenge ? 'challenge' : null;

  return {
    mode,
    activeLivenessPassed: smooth.passed,
    activeLivenessReason: smooth.reason,
    headTurnLeftDetected: readBool(smooth.aggregates.headTurnLeftDetected),
    headTurnRightDetected: readBool(smooth.aggregates.headTurnRightDetected),
    blinkDetected: readBool(smooth.aggregates.blinkDetected),
    smileDetected: readBool(smooth.aggregates.smileDetected),
    expressionAntiSpoofPassed:
      expressionFromRoot?.passed ??
      smooth.expressionAntiSpoof?.passed ??
      readBool(smooth.aggregates.expressionAntiSpoofPassed),
    expressionAntiSpoofReason:
      expressionFromRoot?.reason ??
      smooth.expressionAntiSpoof?.reason ??
      null,
    framesWithFace: smooth.framesWithFace,
    framesAnalyzed: smooth.framesAnalyzed,
  };
}

export function buildLivenessVendorSummary(params: {
  passed: boolean;
  checkedAt: Date | null;
  vendor: unknown;
}): LivenessVendorSummary | null {
  if (!params.checkedAt && !params.vendor) return null;

  let vendorStatus: string | null = null;
  if (params.vendor && typeof params.vendor === 'object' && !Array.isArray(params.vendor)) {
    const v = params.vendor as Record<string, unknown>;
    if (v.localFaceCheck === true && (v.outboundSkipped === true || v.paused === true)) {
      vendorStatus = 'local-only';
    } else if (typeof v.status === 'string') vendorStatus = v.status;
    else if (typeof v.success === 'boolean') vendorStatus = v.success ? 'success' : 'failed';
  }

  const active = extractActiveLivenessFromVendor(params.vendor);

  return {
    passed: params.passed,
    checkedAt: params.checkedAt?.toISOString() ?? null,
    vendorScore: extractLivenessScore(params.vendor),
    isLive: extractLivenessIsLive(params.vendor),
    vendorStatus,
    ...active,
  };
}
