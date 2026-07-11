import type { ExpressionFrameMetric } from './kyc-face-expression.util';
import {
  evaluateActiveLivenessChallenge,
  type ActiveLivenessThresholds,
} from './kyc-active-liveness.util';
import {
  resolveSmoothLivenessSegments,
  sliceSmoothLivenessFrames,
  type SmoothLivenessSegment,
} from './kyc-smooth-liveness-segments.util';

export type SmoothLivenessEvaluation = {
  passed: boolean;
  reason: string;
  aggregates: Record<string, number | null | boolean | string>;
};

function numbers(values: Array<number | null>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

function min(values: number[]): number | null {
  return values.length ? Math.min(...values) : null;
}

function max(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

function evaluateSmileOnFrames(
  frames: ExpressionFrameMetric[],
  thresholds: ActiveLivenessThresholds,
): {
  smileDetected: boolean;
  minSmile: number | null;
  maxSmile: number | null;
  smileDelta: number | null;
  smileFromLandmarks: boolean;
  happyDelta: number | null;
  secondHappyAvg: number | null;
  smileFromExpression: boolean;
} {
  const withFace = frames.filter((f) => f.faceDetected);
  const smile = numbers(withFace.map((f) => f.smileRatio));
  const minSmile = min(smile);
  const maxSmile = max(smile);
  const smileDelta =
    minSmile != null && maxSmile != null ? maxSmile - minSmile : null;

  const midpoint = Math.floor(withFace.length / 2);
  const firstHalfHappy = numbers(
    withFace.slice(0, midpoint).map((f) => f.expressions?.happy ?? null),
  );
  const secondHalfHappy = numbers(
    withFace.slice(midpoint).map((f) => f.expressions?.happy ?? null),
  );
  const firstHappyAvg = firstHalfHappy.length
    ? firstHalfHappy.reduce((a, b) => a + b, 0) / firstHalfHappy.length
    : null;
  const secondHappyAvg = secondHalfHappy.length
    ? secondHalfHappy.reduce((a, b) => a + b, 0) / secondHalfHappy.length
    : null;
  const happyDelta =
    firstHappyAvg != null && secondHappyAvg != null
      ? secondHappyAvg - firstHappyAvg
      : null;

  const smileFromLandmarks =
    maxSmile != null &&
    ((smileDelta != null && smileDelta >= thresholds.smileDelta) ||
      maxSmile >= thresholds.smileAbsolute);

  const smileFromExpression =
    happyDelta != null && happyDelta >= 0.1 && (secondHappyAvg ?? 0) >= 0.35;

  const smileDetected = smileFromLandmarks || smileFromExpression;

  return {
    smileDetected,
    minSmile,
    maxSmile,
    smileDelta,
    smileFromLandmarks,
    happyDelta,
    secondHappyAvg,
    smileFromExpression,
  };
}

function evaluateHeadTurnOnFrames(
  frames: ExpressionFrameMetric[],
  thresholds: ActiveLivenessThresholds,
): {
  headTurnLeftDetected: boolean;
  headTurnRightDetected: boolean;
  headRotated: boolean;
  headTurnsDetected: boolean;
  minYaw: number | null;
  maxYaw: number | null;
  maxAbsYaw: number | null;
} {
  const withFace = frames.filter((f) => f.faceDetected);
  const yaw = numbers(withFace.map((f) => f.yaw));
  const minYaw = min(yaw);
  const maxYaw = max(yaw);
  const maxAbsYaw =
    minYaw != null && maxYaw != null
      ? Math.max(Math.abs(minYaw), Math.abs(maxYaw))
      : null;

  const leftTurn = evaluateActiveLivenessChallenge('turn_left', withFace, thresholds);
  const rightTurn = evaluateActiveLivenessChallenge('turn_right', withFace, thresholds);
  const headTurnLeftDetected = leftTurn.passed;
  const headTurnRightDetected = rightTurn.passed;
  const headRotated =
    maxAbsYaw != null && maxAbsYaw >= thresholds.turnYaw;
  const headTurnsDetected =
    headTurnLeftDetected || headTurnRightDetected || headRotated;

  return {
    headTurnLeftDetected,
    headTurnRightDetected,
    headRotated,
    headTurnsDetected,
    minYaw,
    maxYaw,
    maxAbsYaw,
  };
}

/**
 * One continuous capture: verify the head rotated (left or right) and smile.
 * When segment metadata is present, head turn is scored on turn-burst frames only
 * and smile on smile-burst frames only.
 */
export function evaluateSmoothLivenessSession(
  frames: ExpressionFrameMetric[],
  thresholds: ActiveLivenessThresholds,
  options?: { segments?: SmoothLivenessSegment[] | null },
): SmoothLivenessEvaluation {
  const withFace = frames.filter((f) => f.faceDetected);
  if (withFace.length < thresholds.minFramesWithFace) {
    return {
      passed: false,
      reason: `Keep your face in the oval (${withFace.length}/${thresholds.minFramesWithFace} clear frames).`,
      aggregates: { framesWithFace: withFace.length, failedStep: 'face' },
    };
  }

  const resolvedSegments = resolveSmoothLivenessSegments(frames.length, options?.segments);
  const turnFrames = resolvedSegments
    ? sliceSmoothLivenessFrames(frames, resolvedSegments, 'turn')
    : frames;
  const smileFrames = resolvedSegments
    ? sliceSmoothLivenessFrames(frames, resolvedSegments, 'smile')
    : frames;

  const head = evaluateHeadTurnOnFrames(turnFrames, thresholds);
  const smileEval = evaluateSmileOnFrames(smileFrames, thresholds);
  const smileDetected = smileEval.smileDetected;
  const headTurnsDetected = head.headTurnsDetected;

  const passed = headTurnsDetected && smileDetected;

  let reason = 'Live face verified — head movement and smile detected.';
  let failedStep: string | null = null;
  if (!headTurnsDetected && !smileDetected) {
    reason =
      'Face the camera, turn your head to the left or right when prompted, then smile.';
    failedStep = 'both';
  } else if (!headTurnsDetected) {
    failedStep = 'head_turn';
    if (smileDetected) {
      reason =
        'Your smile was detected, but head movement was too small. When you see TURN YOUR HEAD, turn more clearly to the left or right.';
    } else {
      reason =
        'Turn your head clearly to the left or right when prompted — keep your face in the oval.';
    }
  } else if (!smileDetected) {
    failedStep = 'smile';
    reason = 'Smile naturally when prompted — start neutral, then smile.';
  }

  return {
    passed,
    reason,
    aggregates: {
      framesWithFace: withFace.length,
      turnFramesAnalyzed: turnFrames.length,
      smileFramesAnalyzed: smileFrames.length,
      segmentedEvaluation: Boolean(resolvedSegments),
      failedStep,
      minYaw: head.minYaw,
      maxYaw: head.maxYaw,
      maxAbsYaw: head.maxAbsYaw,
      headRotated: head.headRotated,
      headTurnLeftDetected: head.headTurnLeftDetected,
      headTurnRightDetected: head.headTurnRightDetected,
      headTurnsDetected,
      minSmileRatio: smileEval.minSmile,
      maxSmileRatio: smileEval.maxSmile,
      smileDelta: smileEval.smileDelta,
      smileFromLandmarks: smileEval.smileFromLandmarks,
      happyDelta: smileEval.happyDelta,
      secondHalfHappyAvg: smileEval.secondHappyAvg,
      smileFromExpression: smileEval.smileFromExpression,
      smileDetected,
    },
  };
}
