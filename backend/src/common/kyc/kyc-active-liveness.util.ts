/**
 * Active (challenge–response) liveness geometry + evaluation helpers.
 *
 * Unlike passive liveness (a single selfie scored by a vendor), active liveness
 * asks the user to perform a randomized action (blink, turn head, smile, open
 * mouth) and verifies the action actually happened across a short burst of
 * frames. These pure helpers derive per-frame metrics from face landmarks and
 * decide whether a given challenge was satisfied. Thresholds are injected so the
 * service can override them from env for calibration.
 */

export type Point = { x: number; y: number };

export const ACTIVE_LIVENESS_CHALLENGES = [
  'blink',
  'turn_left',
  'turn_right',
  'smile',
  'mouth_open',
] as const;

export type ActiveLivenessChallenge = (typeof ACTIVE_LIVENESS_CHALLENGES)[number];

export function isActiveLivenessChallenge(value: unknown): value is ActiveLivenessChallenge {
  return (
    typeof value === 'string' &&
    (ACTIVE_LIVENESS_CHALLENGES as readonly string[]).includes(value)
  );
}

/**
 * When true, active liveness is treated as optional (dev / calibration): challenges
 * auto-pass and the customer face step can complete without a verified action.
 * Controlled by `ACTIVE_LIVENESS_DISABLED`.
 */
export function isActiveLivenessDisabled(): boolean {
  const raw = (process.env.ACTIVE_LIVENESS_DISABLED ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export type ActiveLivenessThresholds = {
  /** Min frames (with a face) needed to evaluate a challenge. */
  minFramesWithFace: number;
  /** Eye Aspect Ratio at/above which the eye is considered open. */
  earOpen: number;
  /** Eye Aspect Ratio at/below which the eye is considered closed (blink). */
  earClosed: number;
  /** Mouth Aspect Ratio at/above which the mouth is considered open. */
  mouthOpen: number;
  /** Mouth Aspect Ratio at/below which the mouth is considered closed. */
  mouthClosed: number;
  /** Increase in mouth-width / inter-ocular ratio that counts as a smile. */
  smileDelta: number;
  /** Absolute mouth-width / inter-ocular ratio that counts as a smile. */
  smileAbsolute: number;
  /** Normalized yaw magnitude that counts as a head turn. */
  turnYaw: number;
  /**
   * When true, invert the yaw sign convention (some webcams / capture paths
   * mirror the frame). Left/right challenges use the sign of yaw.
   */
  invertYaw: boolean;
};

export const DEFAULT_ACTIVE_LIVENESS_THRESHOLDS: ActiveLivenessThresholds = {
  minFramesWithFace: 3,
  earOpen: 0.24,
  earClosed: 0.21,
  mouthOpen: 0.5,
  mouthClosed: 0.4,
  smileDelta: 0.06,
  smileAbsolute: 1.45,
  turnYaw: 0.12,
  invertYaw: false,
};

export type ActiveLivenessFrameMetric = {
  index: number;
  faceDetected: boolean;
  detectionScore: number | null;
  /** Average Eye Aspect Ratio (both eyes). */
  ear: number | null;
  earLeft: number | null;
  earRight: number | null;
  /** Mouth Aspect Ratio (open-ness). */
  mouthOpenRatio: number | null;
  /** Mouth width / inter-ocular distance (smile widens the mouth). */
  smileRatio: number | null;
  /** Normalized horizontal head yaw (sign = direction). */
  yaw: number | null;
};

export type ActiveLivenessEvaluation = {
  passed: boolean;
  reason: string;
  aggregates: Record<string, number | null>;
};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function centroid(points: Point[]): Point {
  if (!points.length) return { x: 0, y: 0 };
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y };
}

/** Eye Aspect Ratio from 6 ordered eye landmarks (face-api getLeftEye/getRightEye). */
export function eyeAspectRatio(eye: Point[]): number | null {
  if (eye.length < 6) return null;
  const [p1, p2, p3, p4, p5, p6] = eye;
  const horizontal = 2 * distance(p1!, p4!);
  if (horizontal <= 0) return null;
  const vertical = distance(p2!, p6!) + distance(p3!, p5!);
  return vertical / horizontal;
}

/** Mouth Aspect Ratio (vertical opening / width) from 20 mouth landmarks (48–67). */
export function mouthOpenRatio(mouth: Point[]): number | null {
  if (mouth.length < 10) return null;
  const left = mouth[0]!;
  const right = mouth[6]!;
  const top = mouth[3]!;
  const bottom = mouth[9]!;
  const width = distance(left, right);
  if (width <= 0) return null;
  return distance(top, bottom) / width;
}

/** Mouth width relative to inter-ocular distance — grows when the user smiles. */
export function smileRatio(mouth: Point[], interOcular: number): number | null {
  if (mouth.length < 7 || interOcular <= 0) return null;
  return distance(mouth[0]!, mouth[6]!) / interOcular;
}

/**
 * Normalized head yaw: horizontal offset of the nose tip from the eye midpoint,
 * scaled by inter-ocular distance. Positive = nose shifted toward the right of
 * the (un-mirrored) image.
 */
export function headYaw(
  leftEyeCenter: Point,
  rightEyeCenter: Point,
  noseTip: Point,
): number | null {
  const interOcular = distance(leftEyeCenter, rightEyeCenter);
  if (interOcular <= 0) return null;
  const eyesMidX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
  return (noseTip.x - eyesMidX) / interOcular;
}

function numbers(values: Array<number | null>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

function min(values: number[]): number | null {
  return values.length ? Math.min(...values) : null;
}

function max(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

/**
 * Decide whether the frames satisfy the requested challenge. Pure — all tuning
 * comes from `thresholds`, and all evidence used is returned in `aggregates`.
 */
export function evaluateActiveLivenessChallenge(
  challenge: ActiveLivenessChallenge,
  frames: ActiveLivenessFrameMetric[],
  thresholds: ActiveLivenessThresholds,
): ActiveLivenessEvaluation {
  const withFace = frames.filter((f) => f.faceDetected);
  if (withFace.length < thresholds.minFramesWithFace) {
    return {
      passed: false,
      reason: `Not enough frames with a clear face (${withFace.length}/${thresholds.minFramesWithFace} required). Keep your face centered and well lit.`,
      aggregates: { framesWithFace: withFace.length },
    };
  }

  const ear = numbers(withFace.map((f) => f.ear));
  const mar = numbers(withFace.map((f) => f.mouthOpenRatio));
  const smile = numbers(withFace.map((f) => f.smileRatio));
  const yaw = numbers(withFace.map((f) => f.yaw));

  const minEar = min(ear);
  const maxEar = max(ear);
  const minMar = min(mar);
  const maxMar = max(mar);
  const minSmile = min(smile);
  const maxSmile = max(smile);
  const minYaw = min(yaw);
  const maxYaw = max(yaw);

  switch (challenge) {
    case 'blink': {
      const passed =
        minEar != null &&
        maxEar != null &&
        maxEar >= thresholds.earOpen &&
        minEar <= thresholds.earClosed;
      return {
        passed,
        reason: passed
          ? 'Blink detected — eyes went from open to closed.'
          : 'No blink detected. Open your eyes fully, then blink clearly.',
        aggregates: { minEar, maxEar },
      };
    }
    case 'mouth_open': {
      const passed =
        maxMar != null &&
        maxMar >= thresholds.mouthOpen &&
        (minMar == null || minMar <= thresholds.mouthClosed);
      return {
        passed,
        reason: passed
          ? 'Mouth-open detected.'
          : 'Mouth-open not detected. Close your mouth, then open it wide.',
        aggregates: { minMouthOpenRatio: minMar, maxMouthOpenRatio: maxMar },
      };
    }
    case 'smile': {
      const delta = minSmile != null && maxSmile != null ? maxSmile - minSmile : null;
      const passed =
        maxSmile != null &&
        ((delta != null && delta >= thresholds.smileDelta) ||
          maxSmile >= thresholds.smileAbsolute);
      return {
        passed,
        reason: passed
          ? 'Smile detected — mouth widened.'
          : 'Smile not detected. Start with a neutral face, then smile widely.',
        aggregates: { minSmileRatio: minSmile, maxSmileRatio: maxSmile, smileDelta: delta },
      };
    }
    case 'turn_left':
    case 'turn_right': {
      // turn_left => person turns to their left => (un-mirrored) nose shifts to
      // the image right => yaw positive. invertYaw flips this if the capture
      // path mirrors frames.
      const wantPositive = thresholds.invertYaw
        ? challenge === 'turn_right'
        : challenge === 'turn_left';
      const extreme = wantPositive ? maxYaw : minYaw;
      const passed =
        extreme != null &&
        (wantPositive ? extreme >= thresholds.turnYaw : extreme <= -thresholds.turnYaw);
      const dir = challenge === 'turn_left' ? 'left' : 'right';
      return {
        passed,
        reason: passed
          ? `Head turn to the ${dir} detected.`
          : `Head turn to the ${dir} not detected. Face forward, then turn your head to your ${dir}.`,
        aggregates: { minYaw, maxYaw },
      };
    }
    default: {
      return { passed: false, reason: 'Unknown challenge.', aggregates: {} };
    }
  }
}

export function activeLivenessChallengeLabel(challenge: ActiveLivenessChallenge): string {
  switch (challenge) {
    case 'blink':
      return 'Blink your eyes';
    case 'turn_left':
      return 'Turn your head to your left';
    case 'turn_right':
      return 'Turn your head to your right';
    case 'smile':
      return 'Smile';
    case 'mouth_open':
      return 'Open your mouth';
    default:
      return challenge;
  }
}
