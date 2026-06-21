import type { Prisma } from '@prisma/client';
import type { KycFaceMatchInspection } from './kyc-face-match.util';

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
