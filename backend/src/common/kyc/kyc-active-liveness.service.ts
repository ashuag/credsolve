import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import * as faceapi from '@vladmandic/face-api';
import path from 'node:path';
import {
  type ActiveLivenessChallenge,
  type ActiveLivenessFrameMetric,
  type ActiveLivenessThresholds,
  DEFAULT_ACTIVE_LIVENESS_THRESHOLDS,
  centroid,
  evaluateActiveLivenessChallenge,
  eyeAspectRatio,
  headYaw,
  mouthOpenRatio,
  smileRatio,
  type Point,
} from './kyc-active-liveness.util';
import {
  DEFAULT_EXPRESSION_ANTI_SPOOF_THRESHOLDS,
  dominantExpression,
  evaluateExpressionAntiSpoof,
  type ExpressionAntiSpoofThresholds,
  type ExpressionFrameMetric,
  normalizeFaceExpressionScores,
} from './kyc-face-expression.util';
import { evaluateSmoothLivenessSession } from './kyc-smooth-liveness.util';
import type { SmoothLivenessSegment } from './kyc-smooth-liveness-segments.util';

type FaceApiLandmarks = {
  getLeftEye(): Point[];
  getRightEye(): Point[];
  getNose(): Point[];
  getMouth(): Point[];
};

type FaceApiDetectionWithLandmarks = {
  detection: { score: number; box: { x: number; y: number; width: number; height: number } };
  landmarks: FaceApiLandmarks;
};

export type ActiveLivenessAnalysis = {
  challenge: ActiveLivenessChallenge | 'smooth';
  passed: boolean;
  reason: string;
  framesAnalyzed: number;
  framesWithFace: number;
  thresholds: ActiveLivenessThresholds;
  aggregates: Record<string, number | null | boolean | string>;
  frames: ActiveLivenessFrameMetric[] | ExpressionFrameMetric[];
  validationDisabled: boolean;
  expressionAntiSpoof?: {
    passed: boolean;
    reason: string;
    aggregates: Record<string, number | null | boolean | string>;
  };
};

export type ActiveLivenessFacePosition = {
  faceDetected: boolean;
  detectionScore: number | null;
  imageWidth: number;
  imageHeight: number;
  box: { x: number; y: number; width: number; height: number } | null;
  /** Face-box center as a 0–1 fraction of the frame. */
  normalizedCenter: { x: number; y: number } | null;
  /** Face-box height as a 0–1 fraction of the frame height (proximity proxy). */
  faceHeightRatio: number | null;
};

function readBool(name: string): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function readNumber(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Local (on-server) active liveness: derives blink/turn/smile/mouth metrics per frame. */
@Injectable()
export class KycActiveLivenessService implements OnModuleDestroy {
  private readonly logger = new Logger(KycActiveLivenessService.name);
  private modelsReady: Promise<void> | null = null;

  onModuleDestroy(): void {
    this.modelsReady = null;
  }

  resolveThresholds(): ActiveLivenessThresholds {
    return {
      minFramesWithFace: Math.max(
        1,
        Math.round(
          readNumber('ACTIVE_LIVENESS_MIN_FRAMES', DEFAULT_ACTIVE_LIVENESS_THRESHOLDS.minFramesWithFace),
        ),
      ),
      earOpen: readNumber('ACTIVE_LIVENESS_EAR_OPEN', DEFAULT_ACTIVE_LIVENESS_THRESHOLDS.earOpen),
      earClosed: readNumber('ACTIVE_LIVENESS_EAR_CLOSED', DEFAULT_ACTIVE_LIVENESS_THRESHOLDS.earClosed),
      mouthOpen: readNumber('ACTIVE_LIVENESS_MOUTH_OPEN', DEFAULT_ACTIVE_LIVENESS_THRESHOLDS.mouthOpen),
      mouthClosed: readNumber('ACTIVE_LIVENESS_MOUTH_CLOSED', DEFAULT_ACTIVE_LIVENESS_THRESHOLDS.mouthClosed),
      smileDelta: readNumber('ACTIVE_LIVENESS_SMILE_DELTA', DEFAULT_ACTIVE_LIVENESS_THRESHOLDS.smileDelta),
      smileAbsolute: readNumber('ACTIVE_LIVENESS_SMILE_ABS', DEFAULT_ACTIVE_LIVENESS_THRESHOLDS.smileAbsolute),
      turnYaw: readNumber('ACTIVE_LIVENESS_TURN_YAW', DEFAULT_ACTIVE_LIVENESS_THRESHOLDS.turnYaw),
      invertYaw: readBool('ACTIVE_LIVENESS_INVERT_YAW'),
    };
  }

  resolveExpressionThresholds(): ExpressionAntiSpoofThresholds {
    return {
      minExpressionVariance: readNumber(
        'KYC_EXPRESSION_MIN_VARIANCE',
        DEFAULT_EXPRESSION_ANTI_SPOOF_THRESHOLDS.minExpressionVariance,
      ),
      minHappyDelta: readNumber(
        'KYC_EXPRESSION_MIN_HAPPY_DELTA',
        DEFAULT_EXPRESSION_ANTI_SPOOF_THRESHOLDS.minHappyDelta,
      ),
      happySmileMismatchHappy: readNumber(
        'KYC_EXPRESSION_HAPPY_MISMATCH',
        DEFAULT_EXPRESSION_ANTI_SPOOF_THRESHOLDS.happySmileMismatchHappy,
      ),
      happySmileMismatchMinSmileDelta: readNumber(
        'KYC_EXPRESSION_HAPPY_MIN_SMILE_DELTA',
        DEFAULT_EXPRESSION_ANTI_SPOOF_THRESHOLDS.happySmileMismatchMinSmileDelta,
      ),
    };
  }

  isValidationDisabled(): boolean {
    return readBool('ACTIVE_LIVENESS_DISABLED');
  }

  isExpressionAntiSpoofDisabled(): boolean {
    return readBool('KYC_EXPRESSION_ANTI_SPOOF_DISABLED');
  }

  /**
   * Smooth one-shot session: head turns + smile from a continuous capture, plus expression anti-spoof.
   * No head-turn challenges — fewer false failures, better UX.
   */
  async analyzeSmoothSession(frameBuffers: Buffer[]): Promise<ActiveLivenessAnalysis> {
    const thresholds = this.resolveThresholds();
    const frames = await this.measureSmoothSessionFrames(frameBuffers);
    const liveness = this.evaluateSmoothActiveLivenessFromFrames(frames);
    const antiSpoof = this.evaluateExpressionAntiSpoofFromFrames(frames);

    const passed = liveness.passed && antiSpoof.passed;
    const reason = !liveness.passed
      ? liveness.reason
      : !antiSpoof.passed
        ? antiSpoof.reason
        : 'Live face verified — head movement and natural expressions detected.';

    return {
      challenge: 'smooth',
      passed,
      reason,
      framesAnalyzed: frames.length,
      framesWithFace: frames.filter((f) => f.faceDetected).length,
      thresholds,
      aggregates: {
        ...liveness.aggregates,
        expressionAntiSpoofPassed: antiSpoof.passed,
      },
      frames,
      validationDisabled: liveness.validationDisabled,
      expressionAntiSpoof: antiSpoof,
    };
  }

  /** Measures every frame once (expressions + landmarks) for smooth-session pipeline steps. */
  async measureSmoothSessionFrames(frameBuffers: Buffer[]): Promise<ExpressionFrameMetric[]> {
    if (this.isValidationDisabled()) {
      return frameBuffers.map((_, index) => ({
        index,
        faceDetected: false,
        detectionScore: null,
        expressions: null,
        dominantExpression: null,
        ear: null,
        earLeft: null,
        earRight: null,
        mouthOpenRatio: null,
        smileRatio: null,
        yaw: null,
      }));
    }

    await this.ensureModelsLoaded();

    const frames: ExpressionFrameMetric[] = [];
    for (let index = 0; index < frameBuffers.length; index += 1) {
      frames.push(await this.measureFrameWithExpressions(index, frameBuffers[index]!));
    }
    return frames;
  }

  evaluateSmoothActiveLivenessFromFrames(
    frames: ExpressionFrameMetric[],
    options?: { segments?: SmoothLivenessSegment[] | null },
  ): {
    passed: boolean;
    reason: string;
    framesAnalyzed: number;
    framesWithFace: number;
    thresholds: ActiveLivenessThresholds;
    aggregates: Record<string, number | null | boolean | string>;
    validationDisabled: boolean;
  } {
    const thresholds = this.resolveThresholds();

    if (this.isValidationDisabled()) {
      return {
        passed: true,
        reason: 'ACTIVE_LIVENESS_DISABLED is on — session auto-passed.',
        framesAnalyzed: frames.length,
        framesWithFace: 0,
        thresholds,
        aggregates: {},
        validationDisabled: true,
      };
    }

    const liveness = evaluateSmoothLivenessSession(frames, thresholds, options);
    const framesWithFace = frames.filter((f) => f.faceDetected).length;

    return {
      passed: liveness.passed,
      reason: liveness.passed
        ? 'Head movement and smile detected.'
        : liveness.reason,
      framesAnalyzed: frames.length,
      framesWithFace,
      thresholds,
      aggregates: liveness.aggregates,
      validationDisabled: false,
    };
  }

  evaluateExpressionAntiSpoofFromFrames(frames: ExpressionFrameMetric[]): {
    passed: boolean;
    reason: string;
    aggregates: Record<string, number | null | boolean | string>;
  } {
    if (this.isValidationDisabled() || this.isExpressionAntiSpoofDisabled()) {
      return {
        passed: true,
        reason: this.isExpressionAntiSpoofDisabled()
          ? 'KYC_EXPRESSION_ANTI_SPOOF_DISABLED is on — expression check skipped.'
          : 'ACTIVE_LIVENESS_DISABLED is on — expression check skipped.',
        aggregates: { disabled: true },
      };
    }

    return evaluateExpressionAntiSpoof(frames, this.resolveExpressionThresholds());
  }

  async analyzeFrames(
    challenge: ActiveLivenessChallenge,
    frameBuffers: Buffer[],
  ): Promise<ActiveLivenessAnalysis> {
    const thresholds = this.resolveThresholds();

    if (this.isValidationDisabled()) {
      const frames = frameBuffers.map<ActiveLivenessFrameMetric>((_, index) => ({
        index,
        faceDetected: false,
        detectionScore: null,
        ear: null,
        earLeft: null,
        earRight: null,
        mouthOpenRatio: null,
        smileRatio: null,
        yaw: null,
      }));
      return {
        challenge,
        passed: true,
        reason: 'ACTIVE_LIVENESS_DISABLED is on — challenge auto-passed.',
        framesAnalyzed: frames.length,
        framesWithFace: 0,
        thresholds,
        aggregates: {},
        frames,
        validationDisabled: true,
      };
    }

    await this.ensureModelsLoaded();

    const frames: ActiveLivenessFrameMetric[] = [];
    for (let index = 0; index < frameBuffers.length; index += 1) {
      frames.push(await this.measureFrame(index, frameBuffers[index]!));
    }

    const evaluation = evaluateActiveLivenessChallenge(challenge, frames, thresholds);
    const framesWithFace = frames.filter((f) => f.faceDetected).length;

    return {
      challenge,
      passed: evaluation.passed,
      reason: evaluation.reason,
      framesAnalyzed: frames.length,
      framesWithFace,
      thresholds,
      aggregates: evaluation.aggregates,
      frames,
      validationDisabled: false,
    };
  }

  /** Single-frame face-position probe used to gate the challenge run (face must be inside the guide oval). */
  async detectFacePosition(buffer: Buffer): Promise<ActiveLivenessFacePosition> {
    const empty: ActiveLivenessFacePosition = {
      faceDetected: false,
      detectionScore: null,
      imageWidth: 0,
      imageHeight: 0,
      box: null,
      normalizedCenter: null,
      faceHeightRatio: null,
    };

    if (!buffer?.length) return empty;

    await this.ensureModelsLoaded();

    let tensor: tf.Tensor3D | null = null;
    try {
      tensor = tf.node.decodeImage(buffer, 3) as tf.Tensor3D;
      const [imageHeight, imageWidth] = tensor.shape;
      const best = await this.detectBestFace(tensor);
      if (!best) {
        return { ...empty, imageWidth, imageHeight };
      }
      const box = best.detection.box;
      return {
        faceDetected: true,
        detectionScore: best.detection.score,
        imageWidth,
        imageHeight,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        normalizedCenter:
          imageWidth > 0 && imageHeight > 0
            ? { x: (box.x + box.width / 2) / imageWidth, y: (box.y + box.height / 2) / imageHeight }
            : null,
        faceHeightRatio: imageHeight > 0 ? box.height / imageHeight : null,
      };
    } catch (err) {
      this.logger.warn(
        `Active liveness face-position probe failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return empty;
    } finally {
      tensor?.dispose();
    }
  }

  private async measureFrameWithExpressions(
    index: number,
    buffer: Buffer,
  ): Promise<ExpressionFrameMetric> {
    const base = await this.measureFrame(index, buffer);
    if (!base.faceDetected || !buffer?.length) {
      return { ...base, expressions: null, dominantExpression: null };
    }

    let tensor: tf.Tensor3D | null = null;
    try {
      tensor = tf.node.decodeImage(buffer, 3) as tf.Tensor3D;
      const best = await this.detectBestFaceWithExpressions(tensor);
      const expressions = best?.expressions
        ? normalizeFaceExpressionScores(best.expressions)
        : null;
      return {
        ...base,
        expressions,
        dominantExpression: expressions ? dominantExpression(expressions) : null,
      };
    } catch (err) {
      this.logger.warn(
        `Expression frame ${index} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ...base, expressions: null, dominantExpression: null };
    } finally {
      tensor?.dispose();
    }
  }

  private async measureFrame(index: number, buffer: Buffer): Promise<ActiveLivenessFrameMetric> {
    const empty: ActiveLivenessFrameMetric = {
      index,
      faceDetected: false,
      detectionScore: null,
      ear: null,
      earLeft: null,
      earRight: null,
      mouthOpenRatio: null,
      smileRatio: null,
      yaw: null,
    };

    if (!buffer?.length) return empty;

    let tensor: tf.Tensor3D | null = null;
    try {
      tensor = tf.node.decodeImage(buffer, 3) as tf.Tensor3D;
      const best = await this.detectBestFace(tensor);
      if (!best) return empty;

      const leftEye = best.landmarks.getLeftEye();
      const rightEye = best.landmarks.getRightEye();
      const mouth = best.landmarks.getMouth();
      const nose = best.landmarks.getNose();

      const leftCenter = centroid(leftEye);
      const rightCenter = centroid(rightEye);
      const interOcular = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
      const noseTip = nose[Math.min(6, nose.length - 1)] ?? centroid(nose);

      const earLeft = eyeAspectRatio(leftEye);
      const earRight = eyeAspectRatio(rightEye);
      const ear =
        earLeft != null && earRight != null
          ? (earLeft + earRight) / 2
          : (earLeft ?? earRight ?? null);

      return {
        index,
        faceDetected: true,
        detectionScore: best.detection.score,
        ear,
        earLeft,
        earRight,
        mouthOpenRatio: mouthOpenRatio(mouth),
        smileRatio: smileRatio(mouth, interOcular),
        yaw: headYaw(leftCenter, rightCenter, noseTip),
      };
    } catch (err) {
      this.logger.warn(
        `Active liveness frame ${index} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return empty;
    } finally {
      tensor?.dispose();
    }
  }

  private async detectBestFaceWithExpressions(
    tensor: tf.Tensor3D,
  ): Promise<(FaceApiDetectionWithLandmarks & { expressions: faceapi.FaceExpressions }) | null> {
    const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2, maxResults: 3 });
    const detections = (await faceapi
      .detectAllFaces(tensor, opts)
      .withFaceLandmarks()
      .withFaceExpressions()) as Array<
      FaceApiDetectionWithLandmarks & { expressions: faceapi.FaceExpressions }
    >;
    if (!detections.length) return null;
    return detections.reduce((best, cur) =>
      cur.detection.score > best.detection.score ? cur : best,
    );
  }

  private async detectBestFace(
    tensor: tf.Tensor3D,
  ): Promise<FaceApiDetectionWithLandmarks | null> {
    const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2, maxResults: 3 });
    const detections = (await faceapi
      .detectAllFaces(tensor, opts)
      .withFaceLandmarks()) as FaceApiDetectionWithLandmarks[];
    if (!detections.length) return null;
    return detections.reduce((best, cur) =>
      cur.detection.score > best.detection.score ? cur : best,
    );
  }

  private async ensureModelsLoaded(): Promise<void> {
    if (!this.modelsReady) {
      this.modelsReady = this.loadModels();
    }
    await this.modelsReady;
  }

  private async loadModels(): Promise<void> {
    const modelDir = path.join(path.dirname(require.resolve('@vladmandic/face-api')), '..', 'model');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir);
    await faceapi.nets.faceExpressionNet.loadFromDisk(modelDir);
    this.logger.log(`Active liveness face models loaded from ${modelDir}`);
  }
}
