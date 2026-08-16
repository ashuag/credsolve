import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type * as tf from '@tensorflow/tfjs-node';
import path from 'node:path';
import {
  computeDetectionUpscaleSize,
  emptyFaceMatchInspection,
  evaluateFaceMatch,
  isKycFaceMatchDisabled,
  KYC_FACE_MATCH_MAX_DISTANCE,
  KYC_FACE_MATCH_MIN_DETECTION_SCORE,
  resolveEffectiveMaxDistance,
  type KycFaceMatchInspection,
  type KycFaceMatchSideResult,
} from './kyc-face-match.util';
import { getFaceApi, getTfNode, isKycMlAvailable, isNonProductionNodeEnv } from './kyc-ml-runtime';
import {
  KYC_SELFIE_MIN_FACE_CONFIDENCE,
  KYC_SELFIE_SECONDARY_FACE_MIN_AREA_RATIO,
} from './kyc-selfie-face-validation.util';

type FaceApiDetectionWithDescriptor = {
  detection: {
    score: number;
    box: { x: number; y: number; width: number; height: number };
  };
  descriptor: Float32Array;
};

type FaceSideDetection = {
  best: FaceApiDetectionWithDescriptor | null;
  /** Faces at/above {@link KYC_SELFIE_MIN_FACE_CONFIDENCE} (dual-face gate). */
  confidentFaceCount: number;
};

@Injectable()
export class KycFaceMatchService implements OnModuleDestroy {
  private readonly logger = new Logger(KycFaceMatchService.name);
  private modelsReady: Promise<void> | null = null;

  onModuleDestroy(): void {
    this.modelsReady = null;
  }

  async compareJpegBuffers(reference: Buffer, probe: Buffer): Promise<KycFaceMatchInspection> {
    if (isKycFaceMatchDisabled() || (!isKycMlAvailable() && isNonProductionNodeEnv())) {
      if (!isKycMlAvailable() && !isKycFaceMatchDisabled()) {
        this.logger.warn('KYC face match skipped: native TensorFlow bindings are unavailable.');
      }
      return {
        ok: true,
        matchPassed: true,
        matchScore: null,
        distance: null,
        maxDistanceThreshold: KYC_FACE_MATCH_MAX_DISTANCE,
        reference: {
          faceDetected: true,
          detectionScore: null,
          imageWidth: 0,
          imageHeight: 0,
          faceCount: 1,
          dualFaceDetected: false,
        },
        probe: {
          faceDetected: true,
          detectionScore: null,
          imageWidth: 0,
          imageHeight: 0,
          faceCount: 1,
          dualFaceDetected: false,
        },
        productionValidationDisabled: true,
      };
    }

    if (!isKycMlAvailable()) {
      return emptyFaceMatchInspection(
        'Face match is unavailable on this server (TensorFlow native bindings failed to load).',
      );
    }

    if (!reference.length || !probe.length) {
      return emptyFaceMatchInspection('Both images must be non-empty JPEGs.');
    }

    await this.ensureModelsLoaded();

    const tf = getTfNode();
    const faceapi = getFaceApi();
    let referenceTensor: tf.Tensor3D | null = null;
    let probeTensor: tf.Tensor3D | null = null;
    let referenceDetectTensor: tf.Tensor3D | null = null;
    let probeDetectTensor: tf.Tensor3D | null = null;

    try {
      referenceTensor = tf.node.decodeImage(reference, 3) as tf.Tensor3D;
      probeTensor = tf.node.decodeImage(probe, 3) as tf.Tensor3D;

      const [referenceOutcome, probeOutcome] = await Promise.all([
        this.detectFacesWithUpscaleFallback(referenceTensor),
        this.detectFacesWithUpscaleFallback(probeTensor),
      ]);
      const referenceFaces = referenceOutcome.result;
      const probeFaces = probeOutcome.result;
      referenceDetectTensor = referenceOutcome.upscaledTensor;
      probeDetectTensor = probeOutcome.upscaledTensor;

      const referenceSide = toSideResult(referenceFaces, referenceTensor);
      const probeSide = toSideResult(probeFaces, probeTensor);

      // Aadhaar / government IDs often include a hologram or ghost portrait. Dual-face on
      // the reference must not skip matching — use the highest-scoring face instead.
      if (probeSide.dualFaceDetected) {
        return {
          ...emptyFaceMatchInspection('Only one person should appear in the probe image.'),
          reference: referenceSide,
          probe: probeSide,
        };
      }

      if (!referenceFaces.best) {
        return {
          ...emptyFaceMatchInspection('No face detected in the reference image.'),
          reference: referenceSide,
          probe: probeSide,
        };
      }
      if (!probeFaces.best) {
        return {
          ...emptyFaceMatchInspection('No face detected in the probe image.'),
          reference: referenceSide,
          probe: probeSide,
        };
      }

      const distance = faceapi.euclideanDistance(
        referenceFaces.best.descriptor,
        probeFaces.best.descriptor,
      );
      const effectiveMaxDistance = resolveEffectiveMaxDistance(referenceFaces.best.detection.score);
      const { matchPassed, matchScore } = evaluateFaceMatch(distance, effectiveMaxDistance);

      return {
        ok: matchPassed,
        matchPassed,
        matchScore,
        distance,
        maxDistanceThreshold: effectiveMaxDistance,
        reference: referenceSide,
        probe: probeSide,
        reason: matchPassed
          ? undefined
          : 'The selfie does not match the Aadhaar photo. Retake a well-lit selfie with your full face visible.',
        productionValidationDisabled: false,
      };
    } catch (err) {
      this.logger.warn(
        `KYC face match inspection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return emptyFaceMatchInspection(
        'We could not compare the faces. Please use clear, front-facing JPEG photos.',
      );
    } finally {
      referenceTensor?.dispose();
      probeTensor?.dispose();
      referenceDetectTensor?.dispose();
      probeDetectTensor?.dispose();
    }
  }

  /**
   * DigiLocker Aadhaar photos are frequently tiny already-cropped faces (~160x200px) where SSD
   * MobileNetv1 detection confidence is low or absent. Upscaling every input unconditionally
   * measurably hurts descriptors that were already detected cleanly (interpolation adds no real
   * detail, only noise), so this only retries at a larger size when the original detection is
   * weak or missing, and keeps whichever result has the higher detection confidence.
   */
  private async detectFacesWithUpscaleFallback(
    tensor: tf.Tensor3D,
  ): Promise<{ result: FaceSideDetection; upscaledTensor: tf.Tensor3D | null }> {
    const original = await this.detectFaces(tensor);
    const originalScore = original.best?.detection.score ?? -1;
    if (originalScore >= KYC_SELFIE_MIN_FACE_CONFIDENCE) {
      return { result: original, upscaledTensor: null };
    }

    const [height, width] = tensor.shape;
    const target = computeDetectionUpscaleSize(height, width);
    if (!target) {
      return { result: original, upscaledTensor: null };
    }

    const tf = getTfNode();
    const upscaled = tf.image.resizeBilinear(tensor, target) as tf.Tensor3D;
    const upscaledResult = await this.detectFaces(upscaled);
    const upscaledScore = upscaledResult.best?.detection.score ?? -1;

    if (upscaledScore > originalScore) {
      return { result: upscaledResult, upscaledTensor: upscaled };
    }
    upscaled.dispose();
    return { result: original, upscaledTensor: null };
  }

  private async detectFaces(tensor: tf.Tensor3D): Promise<FaceSideDetection> {
    const faceapi = getFaceApi();
    const opts = new faceapi.SsdMobilenetv1Options({
      minConfidence: KYC_FACE_MATCH_MIN_DETECTION_SCORE,
      maxResults: 5,
    });
    const detections = (await faceapi
      .detectAllFaces(tensor, opts)
      .withFaceLandmarks()
      .withFaceDescriptors()) as FaceApiDetectionWithDescriptor[];

    if (!detections.length) {
      return { best: null, confidentFaceCount: 0 };
    }

    const confident = detections.filter(
      (d) => d.detection.score >= KYC_SELFIE_MIN_FACE_CONFIDENCE,
    );
    const pool = confident.length > 0 ? confident : detections;
    const best = pool.reduce((top, current) =>
      current.detection.score > top.detection.score ? current : top,
    );

    return {
      best,
      confidentFaceCount: countForegroundFaces(confident),
    };
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
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir);
    this.logger.log(`KYC face match models loaded from ${modelDir}`);
  }
}

/**
 * A second confident detection only counts as another person in frame when it's a meaningful
 * fraction of the largest face's area — otherwise a framed photo or screen visible in the
 * background (a real, confidently-detected face image, just tiny in the shot) would trip the
 * "only one person" dual-face gate. Mirrors {@link KYC_SELFIE_SECONDARY_FACE_MIN_AREA_RATIO}.
 */
function countForegroundFaces(detections: FaceApiDetectionWithDescriptor[]): number {
  if (detections.length <= 1) return detections.length;
  const areaOf = (d: FaceApiDetectionWithDescriptor) => d.detection.box.width * d.detection.box.height;
  const maxArea = Math.max(...detections.map(areaOf));
  if (!Number.isFinite(maxArea) || maxArea <= 0) return detections.length;
  return detections.filter((d) => areaOf(d) / maxArea >= KYC_SELFIE_SECONDARY_FACE_MIN_AREA_RATIO)
    .length;
}

function toSideResult(faces: FaceSideDetection, tensor: tf.Tensor3D): KycFaceMatchSideResult {
  const [imageHeight, imageWidth] = tensor.shape;
  const faceCount = faces.confidentFaceCount;
  return {
    faceDetected: Boolean(faces.best),
    detectionScore: faces.best?.detection.score ?? null,
    imageWidth,
    imageHeight,
    faceCount,
    dualFaceDetected: faceCount > 1,
  };
}
