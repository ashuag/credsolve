import type { Prisma } from '@prisma/client';
import {
  KYC_FACE_MATCH_MAX_DISTANCE,
  type KycFaceMatchInspection,
  type KycFaceMatchSideResult,
} from './kyc-face-match.util';

export const KYC_FACE_MATCH_RETRY_HINT =
  'Please retake your selfie in good lighting with your full face visible, facing the camera.';

export function toPersistedFaceMatchInspection(
  inspection: KycFaceMatchInspection,
): Prisma.InputJsonObject {
  return {
    ok: inspection.ok,
    matchPassed: inspection.matchPassed,
    matchScore: inspection.matchScore,
    distance: inspection.distance,
    maxDistanceThreshold: inspection.maxDistanceThreshold,
    reason: inspection.reason ?? null,
    productionValidationDisabled: inspection.productionValidationDisabled,
    reference: inspection.reference,
    probe: inspection.probe,
    checkedAt: new Date().toISOString(),
  };
}

export type PersistedFaceMatch = {
  passed: boolean;
  checkedAt: string | null;
  matchScore: number | null;
  distance: number | null;
  maxDistanceThreshold: number;
  reason: string | null;
  reference: KycFaceMatchSideResult | null;
  probe: KycFaceMatchSideResult | null;
};

function parseSide(value: unknown): KycFaceMatchSideResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    faceDetected: row.faceDetected === true,
    detectionScore: typeof row.detectionScore === 'number' ? row.detectionScore : null,
    imageWidth: typeof row.imageWidth === 'number' ? row.imageWidth : 0,
    imageHeight: typeof row.imageHeight === 'number' ? row.imageHeight : 0,
  };
}

export function parsePersistedFaceMatch(json: unknown): PersistedFaceMatch | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const row = json as Record<string, unknown>;
  const hasSignal =
    typeof row.matchPassed === 'boolean' ||
    typeof row.ok === 'boolean' ||
    typeof row.checkedAt === 'string' ||
    typeof row.matchScore === 'number' ||
    typeof row.reason === 'string';
  if (!hasSignal) return null;

  const passed =
    typeof row.matchPassed === 'boolean'
      ? row.matchPassed
      : typeof row.ok === 'boolean'
        ? row.ok
        : false;

  return {
    passed,
    checkedAt: typeof row.checkedAt === 'string' ? row.checkedAt : null,
    matchScore: typeof row.matchScore === 'number' ? row.matchScore : null,
    distance: typeof row.distance === 'number' ? row.distance : null,
    maxDistanceThreshold:
      typeof row.maxDistanceThreshold === 'number'
        ? row.maxDistanceThreshold
        : KYC_FACE_MATCH_MAX_DISTANCE,
    reason: typeof row.reason === 'string' ? row.reason : null,
    reference: parseSide(row.reference),
    probe: parseSide(row.probe),
  };
}

/** MoneyCash local face match from `application_kyc.liveness_vendor_json`. */
export function extractLocalFaceMatchFromVendorJson(vendor: unknown): PersistedFaceMatch | null {
  if (!vendor || typeof vendor !== 'object' || Array.isArray(vendor)) return null;
  const root = vendor as Record<string, unknown>;
  const localChecks = root.localChecks;
  if (localChecks && typeof localChecks === 'object' && !Array.isArray(localChecks)) {
    const fromLocal = parsePersistedFaceMatch((localChecks as Record<string, unknown>).faceMatch);
    if (fromLocal) return fromLocal;
  }
  return parsePersistedFaceMatch(root.faceMatch);
}
