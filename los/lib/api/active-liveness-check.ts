import { authorizedLosRequest } from './_shared';

export const ACTIVE_LIVENESS_CHALLENGES = [
  'blink',
  'turn_left',
  'turn_right',
  'smile',
  'mouth_open',
] as const;

export type ActiveLivenessChallenge = (typeof ACTIVE_LIVENESS_CHALLENGES)[number];

export type ActiveLivenessFrameMetric = {
  index: number;
  faceDetected: boolean;
  detectionScore: number | null;
  ear: number | null;
  earLeft: number | null;
  earRight: number | null;
  mouthOpenRatio: number | null;
  smileRatio: number | null;
  yaw: number | null;
};

export type ActiveLivenessThresholds = {
  minFramesWithFace: number;
  earOpen: number;
  earClosed: number;
  mouthOpen: number;
  mouthClosed: number;
  smileDelta: number;
  smileAbsolute: number;
  turnYaw: number;
  invertYaw: boolean;
};

export type LosActiveLivenessCheckResult = {
  challenge: ActiveLivenessChallenge;
  passed: boolean;
  reason: string;
  framesAnalyzed: number;
  framesWithFace: number;
  thresholds: ActiveLivenessThresholds;
  aggregates: Record<string, number | null>;
  frames: ActiveLivenessFrameMetric[];
  validationDisabled: boolean;
};

export const ACTIVE_LIVENESS_CHALLENGE_LABELS: Record<ActiveLivenessChallenge, string> = {
  blink: 'Blink your eyes',
  turn_left: 'Turn your head to your left',
  turn_right: 'Turn your head to your right',
  smile: 'Smile',
  mouth_open: 'Open your mouth',
};

export type ActiveLivenessFacePosition = {
  faceDetected: boolean;
  detectionScore: number | null;
  imageWidth: number;
  imageHeight: number;
  box: { x: number; y: number; width: number; height: number } | null;
  normalizedCenter: { x: number; y: number } | null;
  faceHeightRatio: number | null;
};

export async function checkActiveLivenessFacePosition(
  token: string,
  frame: File,
): Promise<ActiveLivenessFacePosition> {
  const form = new FormData();
  form.set('frame', frame, frame.name || 'frame.jpg');
  return authorizedLosRequest<ActiveLivenessFacePosition>(
    token,
    '/developer-tools/active-liveness-face-position',
    { method: 'POST', body: form },
    'Face position check failed.',
  );
}

export async function runActiveLivenessCheck(
  token: string,
  challenge: ActiveLivenessChallenge,
  frames: File[],
): Promise<LosActiveLivenessCheckResult> {
  const form = new FormData();
  form.set('challenge', challenge);
  frames.forEach((file, i) => form.append('frames', file, file.name || `frame-${i}.jpg`));
  return authorizedLosRequest<LosActiveLivenessCheckResult>(
    token,
    '/developer-tools/active-liveness-check',
    { method: 'POST', body: form },
    'Active liveness check failed.',
  );
}
