import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import * as faceapi from '@vladmandic/face-api';
import path from 'node:path';
import {
  emptyFaceMatchInspection,
  evaluateFaceMatch,
  isKycFaceMatchDisabled,
  KYC_FACE_MATCH_MAX_DISTANCE,
  KYC_FACE_MATCH_MIN_DETECTION_SCORE,
  type KycFaceMatchInspection,
  type KycFaceMatchSideResult,
} from './kyc-face-match.util';

type FaceApiDetectionWithDescriptor = {
  detection: {
    score: number;
    box: { x: number; y: number; width: number; height: number };
  };
  descriptor: Float32Array;
};

@Injectable()
export class KycFaceMatchService implements OnModuleDestroy {
  private readonly logger = new Logger(KycFaceMatchService.name);
  private modelsReady: Promise<void> | null = null;

  onModuleDestroy(): void {
    this.modelsReady = null;
  }

  async compareJpegBuffers(reference: Buffer, probe: Buffer): Promise<KycFaceMatchInspection> {
    if (isKycFaceMatchDisabled()) {
      return {
        ok: true,
        matchPassed: true,
        matchScore: null,
        distance: null,
        maxDistanceThreshold: KYC_FACE_MATCH_MAX_DISTANCE,
        reference: { faceDetected: true, detectionScore: null, imageWidth: 0, imageHeight: 0 },
        probe: { faceDetected: true, detectionScore: null, imageWidth: 0, imageHeight: 0 },
        productionValidationDisabled: true,
      };
    }

    if (!reference.length || !probe.length) {
      return emptyFaceMatchInspection('Both images must be non-empty JPEGs.');
    }

    await this.ensureModelsLoaded();

    let referenceTensor: tf.Tensor3D | null = null;
    let probeTensor: tf.Tensor3D | null = null;

    try {
      referenceTensor = tf.node.decodeImage(reference, 3) as tf.Tensor3D;
      probeTensor = tf.node.decodeImage(probe, 3) as tf.Tensor3D;

      const [referenceFace, probeFace] = await Promise.all([
        this.detectBestFace(referenceTensor),
        this.detectBestFace(probeTensor),
      ]);

      const referenceSide = toSideResult(referenceFace, referenceTensor);
      const probeSide = toSideResult(probeFace, probeTensor);

      if (!referenceFace) {
        return {
          ...emptyFaceMatchInspection('No face detected in the reference image.'),
          reference: referenceSide,
          probe: probeSide,
        };
      }
      if (!probeFace) {
        return {
          ...emptyFaceMatchInspection('No face detected in the probe image.'),
          reference: referenceSide,
          probe: probeSide,
        };
      }

      const distance = faceapi.euclideanDistance(referenceFace.descriptor, probeFace.descriptor);
      const { matchPassed, matchScore } = evaluateFaceMatch(distance);

      return {
        ok: matchPassed,
        matchPassed,
        matchScore,
        distance,
        maxDistanceThreshold: KYC_FACE_MATCH_MAX_DISTANCE,
        reference: referenceSide,
        probe: probeSide,
        reason: matchPassed
          ? undefined
          : 'The faces do not appear to match. Use a clearer reference photo and a well-lit selfie.',
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
    }
  }

  private async detectBestFace(tensor: tf.Tensor3D): Promise<FaceApiDetectionWithDescriptor | null> {
    const opts = new faceapi.SsdMobilenetv1Options({
      minConfidence: KYC_FACE_MATCH_MIN_DETECTION_SCORE,
      maxResults: 3,
    });
    const detections = (await faceapi
      .detectAllFaces(tensor, opts)
      .withFaceLandmarks()
      .withFaceDescriptors()) as FaceApiDetectionWithDescriptor[];

    if (!detections.length) {
      return null;
    }

    return detections.reduce((top, current) =>
      current.detection.score > top.detection.score ? current : top,
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
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir);
    this.logger.log(`KYC face match models loaded from ${modelDir}`);
  }
}

function toSideResult(face: FaceApiDetectionWithDescriptor | null, tensor: tf.Tensor3D): KycFaceMatchSideResult {
  const [imageHeight, imageWidth] = tensor.shape;
  return {
    faceDetected: Boolean(face),
    detectionScore: face?.detection.score ?? null,
    imageWidth,
    imageHeight,
  };
}
