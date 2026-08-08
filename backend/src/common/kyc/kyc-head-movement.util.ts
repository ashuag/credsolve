import type { SelfieFaceDetectionInput } from './kyc-selfie-face-validation.util';

/**
 * Head-movement (active liveness) scoring from frames sampled during a short recording.
 *
 * A still photo held up to the camera produces near-zero pose variation, so movement
 * range across frames is the liveness signal. Pose is derived from the 68-point
 * landmarks already produced for selfie validation — no extra model is loaded.
 */

/** Yaw range (nose offset / interocular distance) that scores 1.0. */
export const KYC_HEAD_YAW_FULL_RANGE = 0.4;

/** Pitch range (nose-below-eyes offset / interocular distance) that scores 1.0. */
export const KYC_HEAD_PITCH_FULL_RANGE = 0.35;

/** Roll range in degrees (eye-line tilt) that scores 1.0. */
export const KYC_HEAD_ROLL_FULL_RANGE_DEG = 24;

/** Movement score required to pass. Any single axis clearing its share is enough. */
export const KYC_HEAD_MOVEMENT_MIN_SCORE = 0.35;

/** Frames with exactly one usable face required before scoring is meaningful. */
export const KYC_HEAD_MOVEMENT_MIN_FRAMES_WITH_FACE = 4;

/** Share of sampled frames that must contain a face. */
export const KYC_HEAD_MOVEMENT_MIN_FACE_FRAME_RATIO = 0.6;

/** Lower than the selfie gate: a turned head detects less confidently than a front-on pose. */
export const KYC_HEAD_MOVEMENT_MIN_FRAME_FACE_CONFIDENCE = 0.4;

/** Signed pose of one frame, normalized by interocular distance so it is scale-free. */
export type HeadPoseSample = {
  /** Negative = nose toward frame-left, positive = nose toward frame-right. */
  yaw: number;
  /** Negative = nose rides high (chin up), positive = nose rides low (chin down). */
  pitch: number;
  /** Eye-line tilt in degrees. */
  rollDeg: number;
};

export type HeadMovementDirection = 'left' | 'right' | 'up' | 'down' | 'tilt';

export type HeadMovementInspection = {
  passed: boolean;
  /** 0–1 movement strength; the strongest axis wins (movement in any direction counts). */
  score: number;
  minScoreRequired: number;
  framesAnalyzed: number;
  framesWithFace: number;
  yawRange: number;
  pitchRange: number;
  rollRangeDeg: number;
  directions: HeadMovementDirection[];
  /** Kept for the LOS active-liveness signal chips. */
  headTurnLeftDetected: boolean;
  headTurnRightDetected: boolean;
  headTiltUpDetected: boolean;
  headTiltDownDetected: boolean;
  reason: string | null;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Pose proxy from eye centers, nose tip and mouth center.
 * Turning the head moves the nose off the eye midpoint; nodding changes how far
 * the nose sits below the eye line. Both are divided by interocular distance so
 * moving closer to or further from the camera does not register as movement.
 */
export function computeHeadPoseSample(
  landmarks: SelfieFaceDetectionInput['landmarks'],
): HeadPoseSample | null {
  const { leftEye, rightEye, noseTip } = landmarks;
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const interocular = Math.hypot(dx, dy);
  if (!Number.isFinite(interocular) || interocular < 8) return null;

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;

  return {
    yaw: (noseTip.x - eyeMidX) / interocular,
    pitch: (noseTip.y - eyeMidY) / interocular,
    rollDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

function range(values: number[]): number {
  if (values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
}

/** Signed swing away from the session's own baseline (median), not from an absolute pose. */
function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

export function scoreHeadMovement(params: {
  poses: Array<HeadPoseSample | null>;
  framesAnalyzed: number;
}): HeadMovementInspection {
  const poses = params.poses.filter((p): p is HeadPoseSample => p != null);
  const framesAnalyzed = Math.max(params.framesAnalyzed, poses.length);
  const framesWithFace = poses.length;

  const base: Omit<HeadMovementInspection, 'passed' | 'reason'> = {
    score: 0,
    minScoreRequired: KYC_HEAD_MOVEMENT_MIN_SCORE,
    framesAnalyzed,
    framesWithFace,
    yawRange: 0,
    pitchRange: 0,
    rollRangeDeg: 0,
    directions: [],
    headTurnLeftDetected: false,
    headTurnRightDetected: false,
    headTiltUpDetected: false,
    headTiltDownDetected: false,
  };

  if (framesWithFace < KYC_HEAD_MOVEMENT_MIN_FRAMES_WITH_FACE) {
    return {
      ...base,
      passed: false,
      reason:
        'We could not see your face for enough of the recording. Keep your full face in frame and record again.',
    };
  }

  if (framesAnalyzed > 0 && framesWithFace / framesAnalyzed < KYC_HEAD_MOVEMENT_MIN_FACE_FRAME_RATIO) {
    return {
      ...base,
      passed: false,
      reason: 'Your face left the frame during the recording. Stay centred and record again.',
    };
  }

  const yaws = poses.map((p) => p.yaw);
  const pitches = poses.map((p) => p.pitch);
  const rolls = poses.map((p) => p.rollDeg);

  const yawRange = range(yaws);
  const pitchRange = range(pitches);
  const rollRangeDeg = range(rolls);

  const score = clamp01(
    Math.max(
      yawRange / KYC_HEAD_YAW_FULL_RANGE,
      pitchRange / KYC_HEAD_PITCH_FULL_RANGE,
      rollRangeDeg / KYC_HEAD_ROLL_FULL_RANGE_DEG,
    ),
  );

  // A direction counts once the swing from the resting pose covers half the passing threshold.
  const yawBaseline = median(yaws);
  const pitchBaseline = median(pitches);
  const axisTrigger = (KYC_HEAD_MOVEMENT_MIN_SCORE / 2) * KYC_HEAD_YAW_FULL_RANGE;
  const pitchTrigger = (KYC_HEAD_MOVEMENT_MIN_SCORE / 2) * KYC_HEAD_PITCH_FULL_RANGE;

  const headTurnLeftDetected = yawBaseline - Math.min(...yaws) >= axisTrigger;
  const headTurnRightDetected = Math.max(...yaws) - yawBaseline >= axisTrigger;
  const headTiltUpDetected = pitchBaseline - Math.min(...pitches) >= pitchTrigger;
  const headTiltDownDetected = Math.max(...pitches) - pitchBaseline >= pitchTrigger;
  const tiltDetected = rollRangeDeg >= (KYC_HEAD_MOVEMENT_MIN_SCORE / 2) * KYC_HEAD_ROLL_FULL_RANGE_DEG;

  const directions: HeadMovementDirection[] = [];
  if (headTurnLeftDetected) directions.push('left');
  if (headTurnRightDetected) directions.push('right');
  if (headTiltUpDetected) directions.push('up');
  if (headTiltDownDetected) directions.push('down');
  if (tiltDetected) directions.push('tilt');

  const passed = score >= KYC_HEAD_MOVEMENT_MIN_SCORE && directions.length > 0;

  return {
    passed,
    score,
    minScoreRequired: KYC_HEAD_MOVEMENT_MIN_SCORE,
    framesAnalyzed,
    framesWithFace,
    yawRange,
    pitchRange,
    rollRangeDeg,
    directions,
    headTurnLeftDetected,
    headTurnRightDetected,
    headTiltUpDetected,
    headTiltDownDetected,
    reason: passed
      ? null
      : 'We did not detect enough head movement. Slowly turn your head left and right (or nod) while recording.',
  };
}

export type HeadMovementSnapshot = {
  /** A recording was uploaded and scored, whatever the outcome. */
  captured: boolean;
  passed: boolean;
  score: number | null;
  reason: string | null;
};

/** Pulls the `activeLiveness` block out of a full `liveness_vendor_json` value. */
export function extractActiveLivenessBlock(vendorJson: unknown): Record<string, unknown> | null {
  if (!vendorJson || typeof vendorJson !== 'object' || Array.isArray(vendorJson)) return null;
  const block = (vendorJson as Record<string, unknown>).activeLiveness;
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  return block as Record<string, unknown>;
}

/** Reads the persisted head-movement result. Accepts the `activeLiveness` block, or null. */
export function readHeadMovementSnapshot(block: unknown): HeadMovementSnapshot {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return { captured: false, passed: false, score: null, reason: null };
  }
  const record = block as Record<string, unknown>;
  const score =
    typeof record.headMovementScore === 'number' && Number.isFinite(record.headMovementScore)
      ? record.headMovementScore
      : null;
  const reason =
    typeof record.reason === 'string' && record.reason.trim() ? record.reason.trim() : null;
  return { captured: true, passed: record.passed === true, score, reason };
}

/** Vendor-JSON block merged into `application_kyc.liveness_vendor_json` under `activeLiveness`. */
export function toPersistedHeadMovement(
  inspection: HeadMovementInspection,
  videoPath: string | null,
): Record<string, unknown> {
  const checkedAt = new Date().toISOString();
  return {
    mode: 'smooth',
    passed: inspection.passed,
    reason: inspection.reason,
    checkedAt,
    videoPath,
    headMovementScore: inspection.score,
    minScoreRequired: inspection.minScoreRequired,
    aggregates: {
      headTurnLeftDetected: inspection.headTurnLeftDetected,
      headTurnRightDetected: inspection.headTurnRightDetected,
      headTiltUpDetected: inspection.headTiltUpDetected,
      headTiltDownDetected: inspection.headTiltDownDetected,
      directions: inspection.directions,
      yawRange: inspection.yawRange,
      pitchRange: inspection.pitchRange,
      rollRangeDeg: inspection.rollRangeDeg,
      framesWithFace: inspection.framesWithFace,
      framesAnalyzed: inspection.framesAnalyzed,
    },
  };
}
