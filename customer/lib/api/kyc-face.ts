import { apiPost, apiPostFormData } from './client';

export type PostKycSelfieResponse = {
  success: true;
  selfieRelativePath: string;
};

export type PostKycLivenessVideoResponse = {
  success: true;
  passed: boolean;
  /** 0–1 head-movement strength scored on the server from the sampled frames. */
  score: number;
  minScoreRequired: number;
  framesAnalyzed: number;
  framesWithFace: number;
  directions: string[];
  reason: string | null;
  livenessVideoPath: string | null;
};

/** Per-gate verdicts from the on-server face-api pipeline (same checks the LOS tool reports). */
export type KycPhotoQualitySummary = {
  blurPassed: boolean | null;
  lightingPassed: boolean | null;
  fullFaceDetected: boolean;
  faceNotCovered: boolean;
  dualFaceDetected: boolean;
  faceCount: number;
  qualityScore: number | null;
  ok: boolean;
  reason?: string;
};

export type PostKycLivenessResponse = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  livenessPassed: boolean;
  vendorErrorMessage?: string;
  faceValidationPassed?: boolean;
  faceValidationMessage?: string;
  faceMatchPassed?: boolean;
  faceMatchMessage?: string;
  suggestRetrySelfie?: boolean;
  bestComputedConfidence?: number | null;
  /** Blur / lighting / dual-face / framing verdicts for the captured selfie. */
  selfieQuality?: KycPhotoQualitySummary;
  /** Same gates against the DigiLocker Aadhaar photo. */
  aadhaarQuality?: KycPhotoQualitySummary;
  /** MoneyCash active liveness (head movement) recorded before this call. */
  headMovementPassed?: boolean;
  /** False when no clip has been recorded yet, so the UI shows guidance instead of an error. */
  headMovementCaptured?: boolean;
  headMovementScore?: number | null;
  headMovementMessage?: string;
  suggestRetryHeadMovement?: boolean;
};

export function pickLivenessFailureUserMessage(out: PostKycLivenessResponse): string {
  return (
    out.headMovementMessage?.trim() ||
    out.faceValidationMessage?.trim() ||
    out.faceMatchMessage?.trim() ||
    out.vendorErrorMessage?.trim() ||
    'Face verification did not pass. You can try again.'
  );
}

export async function postKycSelfie(file: File): Promise<PostKycSelfieResponse | null> {
  const form = new FormData();
  form.set('selfie', file, 'selfie.jpg');
  return apiPostFormData<PostKycSelfieResponse>(
    '/applications/kyc/selfie',
    form,
    'Unable to upload selfie.',
    { timeoutMs: 45_000 },
  );
}

/** Uploads the head-movement clip plus the stills sampled from it; the server returns the score. */
export async function postKycLivenessVideo(
  videoFile: File,
  frameFiles: File[],
): Promise<PostKycLivenessVideoResponse | null> {
  const form = new FormData();
  form.set('video', videoFile, videoFile.name);
  for (const frame of frameFiles) {
    form.append('frames', frame, frame.name);
  }
  return apiPostFormData<PostKycLivenessVideoResponse>(
    '/applications/kyc/liveness-video',
    form,
    'Unable to upload the head-movement recording.',
    { timeoutMs: 90_000 },
  );
}

export async function postKycLiveness(): Promise<PostKycLivenessResponse | null> {
  return apiPost<PostKycLivenessResponse>(
    '/applications/kyc/liveness',
    {},
    'Unable to run liveness check.',
    { timeoutMs: 60_000 },
  );
}
