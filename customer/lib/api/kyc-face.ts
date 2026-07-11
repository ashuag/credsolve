import { apiPostFormData } from './client';
import {
  isKycVendorTechnicalFailure,
  KYC_SELFIE_GENERIC_RETRY_MESSAGE,
} from '../kyc-liveness-messages';

export type PostKycSelfieResponse = {
  success: true;
  selfieRelativePath: string;
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
  /** Active (challenge–response) liveness result. */
  activeLivenessPassed?: boolean;
  activeLivenessMessage?: string;
  expressionAntiSpoofPassed?: boolean;
  expressionAntiSpoofMessage?: string;
  faceMatchPassed?: boolean;
  faceMatchMessage?: string;
  suggestRetrySelfie?: boolean;
  bestComputedConfidence?: number | null;
  /** Generic customer copy from API (preferred over raw vendor fields). */
  customerMessage?: string;
  /** Terminal failure — attempts exhausted; show thank-you, not retry. */
  internalError?: boolean;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  attemptsRemaining?: number;
};

export const ACTIVE_LIVENESS_CHALLENGES = [
  'blink',
  'turn_left',
  'turn_right',
  'smile',
  'mouth_open',
] as const;

export type ActiveLivenessChallenge = (typeof ACTIVE_LIVENESS_CHALLENGES)[number];

export const ACTIVE_LIVENESS_CHALLENGE_LABELS: Record<ActiveLivenessChallenge, string> = {
  blink: 'Blink your eyes',
  turn_left: 'Turn your head to your left',
  turn_right: 'Turn your head to your right',
  smile: 'Smile',
  mouth_open: 'Open your mouth',
};

export type SmoothLivenessSegmentMeta = {
  phase: 'baseline' | 'turn' | 'smile';
  count: number;
};

export type ActiveLivenessSegment = {
  challenge: ActiveLivenessChallenge;
  frames: File[];
};

export type KycFacePosition = {
  faceDetected: boolean;
  detectionScore: number | null;
  imageWidth: number;
  imageHeight: number;
  box: { x: number; y: number; width: number; height: number } | null;
  normalizedCenter: { x: number; y: number } | null;
  faceHeightRatio: number | null;
};

export function pickLivenessFailureUserMessage(out: PostKycLivenessResponse): string {
  if (out.internalError) {
    return (
      out.customerMessage?.trim() ||
      'Thank you for your request. One of our representatives will contact you shortly for additional information. We appreciate your patience.'
    );
  }
  if (isKycVendorTechnicalFailure(out)) {
    return KYC_SELFIE_GENERIC_RETRY_MESSAGE;
  }

  if (out.faceValidationPassed === false) {
    return (
      out.faceValidationMessage?.trim() ||
      'Your selfie did not pass quality checks. Use good lighting and keep your face centered.'
    );
  }
  if (out.faceMatchPassed === false) {
    return (
      out.faceMatchMessage?.trim() ||
      'Your selfie did not match your Aadhaar photo. Try again in similar lighting.'
    );
  }
  if (out.expressionAntiSpoofPassed === false) {
    return (
      out.expressionAntiSpoofMessage?.trim() ||
      'Facial expressions looked static. Use your live camera, not a photo or screen.'
    );
  }
  if (out.activeLivenessPassed === false) {
    const msg = out.activeLivenessMessage?.trim() ?? '';
    const lower = msg.toLowerCase();
    let hint = '';
    if (lower.includes('smile was detected') || lower.includes('head movement was too small')) {
      hint =
        ' When you see TURN YOUR HEAD, turn more clearly to the left or right — a small tilt is not enough.';
    } else if (lower.includes('smile')) {
      hint = ' When you see SMILE NOW, smile naturally and hold it briefly.';
    } else if (lower.includes('turn')) {
      hint = ' When prompted, turn your head clearly to the left or right.';
    }
    return (msg || 'We could not verify your head movement and smile.') + hint;
  }

  return (
    out.customerMessage?.trim() ||
    out.activeLivenessMessage?.trim() ||
    out.expressionAntiSpoofMessage?.trim() ||
    out.faceValidationMessage?.trim() ||
    out.faceMatchMessage?.trim() ||
    KYC_SELFIE_GENERIC_RETRY_MESSAGE
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

/** Single-frame probe so the UI can confirm the face is inside the guide oval before the run. */
export async function checkKycFacePosition(frame: File): Promise<KycFacePosition | null> {
  const form = new FormData();
  form.set('frame', frame, frame.name || 'frame.jpg');
  return apiPostFormData<KycFacePosition>(
    '/applications/kyc/face-position',
    form,
    'Face position check failed.',
    { timeoutMs: 20_000 },
  );
}

export async function postKycActiveLiveness(params: {
  frames: File[];
  video: Blob | null;
  mode?: 'smooth' | 'challenges';
  segments?: ActiveLivenessSegment[];
  smoothSegments?: SmoothLivenessSegmentMeta[];
}): Promise<PostKycLivenessResponse | null> {
  const form = new FormData();
  const mode = params.mode ?? 'smooth';
  form.set('mode', mode);

  if (mode === 'challenges' && params.segments?.length) {
    const meta = params.segments.map((seg) => ({
      challenge: seg.challenge,
      count: seg.frames.length,
    }));
    form.set('challenges', JSON.stringify(meta));
    params.segments.forEach((seg) => {
      seg.frames.forEach((file, i) => form.append('frames', file, file.name || `frame-${i}.jpg`));
    });
  } else {
    params.frames.forEach((file, i) => form.append('frames', file, file.name || `frame-${i}.jpg`));
    if (params.smoothSegments?.length) {
      form.set('smoothSegments', JSON.stringify(params.smoothSegments));
    }
  }

  if (params.video && params.video.size > 0) {
    const ext = params.video.type.includes('mp4') ? 'mp4' : 'webm';
    const mime = params.video.type.includes('video/') ? params.video.type : `video/${ext}`;
    const blob =
      params.video.type.includes('video/') || params.video instanceof File
        ? params.video
        : new Blob([params.video], { type: mime });
    const name = blob instanceof File ? blob.name : `liveness.${ext}`;
    form.set('video', blob, name);
  }
  return apiPostFormData<PostKycLivenessResponse>(
    '/applications/kyc/liveness',
    form,
    'Unable to run liveness check.',
    { timeoutMs: 180_000 },
  );
}
