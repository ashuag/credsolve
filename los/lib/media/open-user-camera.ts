export type OpenUserCameraFailureReason = 'unsupported' | 'insecure' | 'denied' | 'unavailable';

export type OpenUserCameraResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: OpenUserCameraFailureReason };

const CAMERA_CONSTRAINT_ATTEMPTS: MediaStreamConstraints[] = [
  { video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false },
  { video: { facingMode: { ideal: 'user' } }, audio: false },
  { video: true, audio: false },
];

export function openUserCameraErrorMessage(reason: OpenUserCameraFailureReason): string {
  switch (reason) {
    case 'insecure':
      return 'Camera access requires a secure (HTTPS) connection. Open this page over HTTPS and try again.';
    case 'unsupported':
      return 'This browser does not support camera access. Try the latest Chrome or Safari.';
    case 'denied':
      return 'Could not access the camera. Allow camera permission in your browser settings and try again.';
    default:
      return 'Could not open the camera on this device. Close other apps using the camera and try again.';
  }
}

export async function openUserCamera(): Promise<OpenUserCameraResult> {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'unsupported' };
  }
  if (!window.isSecureContext) {
    return { ok: false, reason: 'insecure' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: 'unsupported' };
  }

  let denied = false;
  for (const constraints of CAMERA_CONSTRAINT_ATTEMPTS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { ok: true, stream };
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        denied = true;
        break;
      }
    }
  }

  return { ok: false, reason: denied ? 'denied' : 'unavailable' };
}
