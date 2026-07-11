import type { ActiveLivenessFrameMetric } from './kyc-active-liveness.util';

/** face-api expression classifier output (probabilities sum to ~1). */
export type FaceExpressionScores = {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
};

export type ExpressionFrameMetric = ActiveLivenessFrameMetric & {
  expressions: FaceExpressionScores | null;
  dominantExpression: keyof FaceExpressionScores | null;
};

export type ExpressionAntiSpoofThresholds = {
  /** Min average pairwise distance between expression vectors across frames. */
  minExpressionVariance: number;
  /** Min increase in the `happy` score between session halves (smile phase). */
  minHappyDelta: number;
  /** When `happy` exceeds this, mouth landmarks must also widen. */
  happySmileMismatchHappy: number;
  /** Min smile-ratio delta required when `happy` is high (landmark consistency). */
  happySmileMismatchMinSmileDelta: number;
};

export const DEFAULT_EXPRESSION_ANTI_SPOOF_THRESHOLDS: ExpressionAntiSpoofThresholds = {
  minExpressionVariance: 0.018,
  minHappyDelta: 0.12,
  happySmileMismatchHappy: 0.55,
  happySmileMismatchMinSmileDelta: 0.04,
};

export type ExpressionAntiSpoofEvaluation = {
  passed: boolean;
  reason: string;
  aggregates: Record<string, number | null | boolean | string>;
};

const EXPRESSION_KEYS: Array<keyof FaceExpressionScores> = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
];

function numbers(values: Array<number | null>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

function min(values: number[]): number | null {
  return values.length ? Math.min(...values) : null;
}

function max(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function expressionVector(scores: FaceExpressionScores): number[] {
  return EXPRESSION_KEYS.map((key) => scores[key]);
}

function vectorDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function averagePairwiseExpressionDistance(vectors: number[][]): number | null {
  if (vectors.length < 2) return null;
  let total = 0;
  let count = 0;
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      total += vectorDistance(vectors[i]!, vectors[j]!);
      count += 1;
    }
  }
  return count ? total / count : null;
}

export function dominantExpression(
  scores: FaceExpressionScores,
): keyof FaceExpressionScores {
  let best: keyof FaceExpressionScores = 'neutral';
  let bestScore = -1;
  for (const key of EXPRESSION_KEYS) {
    const value = scores[key];
    if (value > bestScore) {
      bestScore = value;
      best = key;
    }
  }
  return best;
}

export function normalizeFaceExpressionScores(raw: unknown): FaceExpressionScores | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const out = {} as FaceExpressionScores;
  for (const key of EXPRESSION_KEYS) {
    const value = Number(record[key]);
    if (!Number.isFinite(value)) return null;
    out[key] = value;
  }
  return out;
}

/**
 * Heuristic anti-spoof / deepfake screen using expression dynamics + landmark consistency.
 * Flags static expression fields (printed photo / frozen deepfake frame) and mismatched
 * expression vs mouth geometry.
 */
export function evaluateExpressionAntiSpoof(
  frames: ExpressionFrameMetric[],
  thresholds: ExpressionAntiSpoofThresholds,
): ExpressionAntiSpoofEvaluation {
  const withFace = frames.filter((f) => f.faceDetected && f.expressions);
  if (withFace.length < 3) {
    return {
      passed: false,
      reason: 'Not enough frames for expression analysis. Keep your face centered and well lit.',
      aggregates: { framesWithExpression: withFace.length },
    };
  }

  const vectors = withFace.map((f) => expressionVector(f.expressions!));
  const expressionVariance = averagePairwiseExpressionDistance(vectors);
  const happyScores = numbers(withFace.map((f) => f.expressions?.happy ?? null));
  const minHappy = min(happyScores);
  const maxHappy = max(happyScores);
  const happyDelta =
    minHappy != null && maxHappy != null ? maxHappy - minHappy : null;

  const midpoint = Math.floor(withFace.length / 2);
  const firstHalfHappy = average(
    numbers(withFace.slice(0, midpoint).map((f) => f.expressions?.happy ?? null)),
  );
  const secondHalfHappy = average(
    numbers(withFace.slice(midpoint).map((f) => f.expressions?.happy ?? null)),
  );
  const sessionHappyDelta =
    firstHalfHappy != null && secondHalfHappy != null
      ? secondHalfHappy - firstHalfHappy
      : null;

  const smileRatios = numbers(withFace.map((f) => f.smileRatio));
  const minSmile = min(smileRatios);
  const maxSmile = max(smileRatios);
  const smileDelta =
    minSmile != null && maxSmile != null ? maxSmile - minSmile : null;

  const peakHappyFrame = withFace.reduce((best, cur) =>
    (cur.expressions?.happy ?? 0) > (best.expressions?.happy ?? 0) ? cur : best,
  );
  const peakHappy = peakHappyFrame.expressions?.happy ?? null;
  const peakHappySmileDelta =
    peakHappy != null && peakHappy >= thresholds.happySmileMismatchHappy
      ? smileDelta
      : null;

  const frozenExpression =
    expressionVariance != null && expressionVariance < thresholds.minExpressionVariance;
  const landmarkMismatch =
    peakHappy != null &&
    peakHappy >= thresholds.happySmileMismatchHappy &&
    (peakHappySmileDelta == null ||
      peakHappySmileDelta < thresholds.happySmileMismatchMinSmileDelta);
  const insufficientSmileExpression =
    sessionHappyDelta != null && sessionHappyDelta < thresholds.minHappyDelta;

  const passed = !frozenExpression && !landmarkMismatch && !insufficientSmileExpression;

  let reason = 'Natural facial expressions detected.';
  if (frozenExpression) {
    reason =
      'Facial expressions look static — use your live camera, not a photo or screen.';
  } else if (landmarkMismatch) {
    reason =
      'Expression pattern looks unnatural. Face the camera directly and smile naturally when asked.';
  } else if (insufficientSmileExpression) {
    reason =
      'Smile not detected clearly. Relax your face first, then smile when prompted.';
  }

  return {
    passed,
    reason,
    aggregates: {
      framesWithExpression: withFace.length,
      expressionVariance,
      minHappy,
      maxHappy,
      happyDelta,
      sessionHappyDelta,
      minSmileRatio: minSmile,
      maxSmileRatio: maxSmile,
      smileDelta,
      frozenExpression,
      landmarkMismatch,
      insufficientSmileExpression,
    },
  };
}
