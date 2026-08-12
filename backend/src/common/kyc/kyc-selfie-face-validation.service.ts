import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type * as tf from '@tensorflow/tfjs-node';
import path from 'node:path';
import { getFaceApi, getTfNode, isKycMlAvailable, isNonProductionNodeEnv } from './kyc-ml-runtime';
import {
  type KycSelfieFaceInspection,
  type SelfieFaceDetectionInput,
  type SelfieFaceValidationResult,
  KYC_SELFIE_MIN_COMPUTED_CONFIDENCE,
  KYC_SELFIE_MIN_FACE_AREA_RATIO,
  KYC_SELFIE_MIN_FACE_CONFIDENCE,
  enrichSelfieFaceDetectionsWithConfidence,
  filterQualifyingSelfieFaceDetections,
  validateKycSelfieFaceDetections,
} from './kyc-selfie-face-validation.util';
import { pickBestFaceConfidence } from './kyc-selfie-face-confidence.util';
import { KYC_HEAD_MOVEMENT_MIN_FRAME_FACE_CONFIDENCE } from './kyc-head-movement.util';
import {
  KYC_SELFIE_MIN_LAPLACIAN_VARIANCE,
  measureSelfieFaceBlur,
  validateSelfieFaceBlur,
} from './kyc-selfie-face-blur.util';
import {
  KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
  KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
  measureSelfieFaceLighting,
  validateSelfieFaceLighting,
} from './kyc-selfie-face-lighting.util';

type FaceApiLandmarks = {
  getLeftEye(): Array<{ x: number; y: number }>;
  getRightEye(): Array<{ x: number; y: number }>;
  getNose(): Array<{ x: number; y: number }>;
  getMouth(): Array<{ x: number; y: number }>;
};

type FaceApiDetectionWithLandmarks = {
  detection: {
    score: number;
    box: { x: number; y: number; width: number; height: number };
  };
  landmarks: FaceApiLandmarks;
};

function isKycSelfieFaceValidationDisabled(): boolean {
  const raw = (process.env.KYC_SELFIE_FACE_VALIDATION_DISABLED ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

@Injectable()
export class KycSelfieFaceValidationService implements OnModuleDestroy {
  private readonly logger = new Logger(KycSelfieFaceValidationService.name);
  private modelsReady: Promise<void> | null = null;

  onModuleDestroy(): void {
    this.modelsReady = null;
  }

  async validateJpegBuffer(buffer: Buffer): Promise<SelfieFaceValidationResult> {
    if (isKycSelfieFaceValidationDisabled() || (!isKycMlAvailable() && isNonProductionNodeEnv())) {
      if (!isKycMlAvailable() && !isKycSelfieFaceValidationDisabled()) {
        this.logger.warn('KYC selfie validation skipped: native TensorFlow bindings are unavailable.');
      }
      return { ok: true };
    }
    if (!isKycMlAvailable()) {
      return {
        ok: false,
        reason:
          'Selfie face validation is unavailable on this server (TensorFlow native bindings failed to load).',
      };
    }
    const inspection = await this.inspectJpegBuffer(buffer);
    if (inspection.ok) {
      return { ok: true };
    }
    return { ok: false, reason: inspection.reason ?? 'Selfie face validation failed.' };
  }

  /**
   * Dry-run inspection for customer KYC (`verifyPair`) and LOS developer tools.
   * Soft-skips in non-production when native TF bindings are missing — same policy as
   * {@link validateJpegBuffer}.
   */
  async inspectJpegBuffer(buffer: Buffer): Promise<KycSelfieFaceInspection> {
    if (!buffer.length) {
      return emptyInspection('Selfie image is empty.');
    }
    if (isKycSelfieFaceValidationDisabled() || (!isKycMlAvailable() && isNonProductionNodeEnv())) {
      if (!isKycMlAvailable() && !isKycSelfieFaceValidationDisabled()) {
        this.logger.warn('KYC selfie inspection skipped: native TensorFlow bindings are unavailable.');
      }
      return skippedInspection();
    }
    if (!isKycMlAvailable()) {
      return emptyInspection(
        'Selfie face validation is unavailable (TensorFlow native bindings failed to load).',
      );
    }

    await this.ensureModelsLoaded();

    const tf = getTfNode();
    let tensor: tf.Tensor3D | null = null;
    try {
      tensor = tf.node.decodeImage(buffer, 3) as tf.Tensor3D;
      const [imageHeight, imageWidth] = tensor.shape;
      const mapped = await this.detectFaces(tensor);
      const enriched = enrichSelfieFaceDetectionsWithConfidence(mapped, imageWidth, imageHeight);
      const validation = validateKycSelfieFaceDetections({
        detections: enriched,
        imageWidth,
        imageHeight,
      });
      const bestConfidence = pickBestFaceConfidence(enriched, imageWidth, imageHeight);
      const qualifying = filterQualifyingSelfieFaceDetections(enriched);

      let laplacianVariance: number | null = null;
      let blurPassed: boolean | null = null;
      let meanFaceLuminance: number | null = null;
      let darkPixelRatio: number | null = null;
      let luminanceStd: number | null = null;
      let highlightP90: number | null = null;
      let lightingPassed: boolean | null = null;
      let finalOk = validation.ok;
      let finalReason = validation.ok ? undefined : validation.reason;

      if (validation.ok && qualifying.length === 1) {
        const faceBox = qualifying[0]!.box;
        const blur = measureSelfieFaceBlur(tensor, faceBox);
        laplacianVariance = blur.laplacianVariance;
        blurPassed = blur.passed;
        const blurValidation = validateSelfieFaceBlur(blur.laplacianVariance);
        if (!blurValidation.ok) {
          finalOk = false;
          finalReason = blurValidation.reason;
        }

        const lighting = measureSelfieFaceLighting(tensor, faceBox);
        meanFaceLuminance = lighting.meanFaceLuminance;
        darkPixelRatio = lighting.darkPixelRatio;
        luminanceStd = lighting.luminanceStd;
        highlightP90 = lighting.highlightP90;
        lightingPassed = lighting.passed;
        if (finalOk) {
          const lightingValidation = validateSelfieFaceLighting(
            lighting.meanFaceLuminance,
            lighting.darkPixelRatio,
            KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
            KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
            lighting.luminanceStd,
            lighting.highlightP90,
          );
          if (!lightingValidation.ok) {
            finalOk = false;
            finalReason = lightingValidation.reason;
          }
        }
      }

      return {
        ok: finalOk,
        reason: finalReason,
        productionValidationDisabled: isKycSelfieFaceValidationDisabled(),
        imageWidth,
        imageHeight,
        minConfidenceRequired: KYC_SELFIE_MIN_FACE_CONFIDENCE,
        minComputedConfidenceRequired: KYC_SELFIE_MIN_COMPUTED_CONFIDENCE,
        bestComputedConfidence: bestConfidence?.computed ?? null,
        confidenceBreakdown: bestConfidence,
        minFaceAreaRatio: KYC_SELFIE_MIN_FACE_AREA_RATIO,
        laplacianVariance,
        minLaplacianVarianceRequired: KYC_SELFIE_MIN_LAPLACIAN_VARIANCE,
        blurPassed,
        meanFaceLuminance,
        darkPixelRatio,
        luminanceStd,
        highlightP90,
        minMeanFaceLuminanceRequired: KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
        maxDarkPixelRatioAllowed: KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
        lightingPassed,
        rawDetectionCount: enriched.length,
        qualifyingDetectionCount: qualifying.length,
        detections: enriched,
      };
    } catch (err) {
      this.logger.warn(
        `KYC selfie face inspection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return emptyInspection(
        'We could not verify the selfie. Please retake the photo in good lighting with your full face visible.',
      );
    } finally {
      tensor?.dispose();
    }
  }

  /**
   * Highest-scoring face (with landmarks) in one frame sampled from the active-liveness
   * recording. Returns null when no face clears the frame confidence floor.
   */
  async detectFrameLandmarks(buffer: Buffer): Promise<SelfieFaceDetectionInput | null> {
    if (!buffer.length || !isKycMlAvailable()) return null;

    await this.ensureModelsLoaded();

    const tf = getTfNode();
    let tensor: tf.Tensor3D | null = null;
    try {
      tensor = tf.node.decodeImage(buffer, 3) as tf.Tensor3D;
      const detections = await this.detectFaces(tensor);
      const best = detections
        .filter((d) => d.score >= KYC_HEAD_MOVEMENT_MIN_FRAME_FACE_CONFIDENCE)
        .sort((a, b) => b.score - a.score)[0];
      return best ?? null;
    } catch (err) {
      this.logger.warn(
        `KYC liveness frame detection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      tensor?.dispose();
    }
  }

  private async detectFaces(tensor: tf.Tensor3D): Promise<SelfieFaceDetectionInput[]> {
    const faceapi = getFaceApi();
    const opts = new faceapi.SsdMobilenetv1Options({
      minConfidence: 0.1,
      maxResults: 3,
    });
    const detections = (await faceapi
      .detectAllFaces(tensor, opts)
      .withFaceLandmarks()) as FaceApiDetectionWithLandmarks[];

    return detections.map((d) => ({
      score: d.detection.score,
      box: {
        x: d.detection.box.x,
        y: d.detection.box.y,
        width: d.detection.box.width,
        height: d.detection.box.height,
      },
      landmarks: toLandmarkInput(d.landmarks),
    }));
  }

  private async ensureModelsLoaded(): Promise<void> {
    if (!this.modelsReady) {
      this.modelsReady = this.loadModels();
    }
    await this.modelsReady;
  }

  private async loadModels(): Promise<void> {
    const faceapi = getFaceApi();
    const modelDir = path.join(path.dirname(require.resolve('@vladmandic/face-api')), '..', 'model');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir);
    this.logger.log(`KYC selfie face models loaded from ${modelDir}`);
  }
}

function toLandmarkInput(landmarks: FaceApiLandmarks): SelfieFaceDetectionInput['landmarks'] {
  const leftEye = centerPoint(landmarks.getLeftEye());
  const rightEye = centerPoint(landmarks.getRightEye());
  const nose = landmarks.getNose();
  const noseTip = nose[Math.min(3, nose.length - 1)]!;
  const mouth = landmarks.getMouth();

  return {
    leftEye,
    rightEye,
    noseTip: { x: noseTip.x, y: noseTip.y },
    mouthCenter: centerPoint(mouth),
  };
}

function centerPoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y };
}

function emptyInspection(reason: string): KycSelfieFaceInspection {
  return {
    ok: false,
    reason,
    productionValidationDisabled: isKycSelfieFaceValidationDisabled(),
    imageWidth: 0,
    imageHeight: 0,
    minConfidenceRequired: KYC_SELFIE_MIN_FACE_CONFIDENCE,
    minComputedConfidenceRequired: KYC_SELFIE_MIN_COMPUTED_CONFIDENCE,
    bestComputedConfidence: null,
    confidenceBreakdown: null,
    minFaceAreaRatio: KYC_SELFIE_MIN_FACE_AREA_RATIO,
    laplacianVariance: null,
    minLaplacianVarianceRequired: KYC_SELFIE_MIN_LAPLACIAN_VARIANCE,
    blurPassed: null,
    meanFaceLuminance: null,
    darkPixelRatio: null,
    luminanceStd: null,
    highlightP90: null,
    minMeanFaceLuminanceRequired: KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
    maxDarkPixelRatioAllowed: KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
    lightingPassed: null,
    rawDetectionCount: 0,
    qualifyingDetectionCount: 0,
    detections: [],
  };
}

/** Non-production / explicit-disable pass-through so `verifyPair` can continue to face match. */
function skippedInspection(): KycSelfieFaceInspection {
  return {
    ...emptyInspection(''),
    ok: true,
    reason: undefined,
    productionValidationDisabled: true,
    blurPassed: true,
    lightingPassed: true,
    qualifyingDetectionCount: 1,
    rawDetectionCount: 1,
  };
}
