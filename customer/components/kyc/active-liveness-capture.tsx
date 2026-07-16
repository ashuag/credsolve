'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkKycFacePosition,
  type KycFacePosition,
  type PostKycLivenessResponse,
  postKycActiveLiveness,
  postKycSelfie,
} from '@/lib/api/kyc-face';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';

/** Neutral baseline before head turns — no capture until hold completes. */
// TEMP paused with active liveness — restore when resuming turn/smile capture:
// const PREP_HOLD_MS = 1500;
// const PREP_BASELINE_FRAMES = 4;
// const PREP_BASELINE_INTERVAL_MS = 500;
// const TURN_BURST_FRAMES = 12;
// const TURN_FRAME_INTERVAL_MS = 120;
// const SMILE_BURST_FRAMES = 12;
// const SMILE_FRAME_INTERVAL_MS = 220;

const CAPTURE_MAX_WIDTH = 480;
const FACE_POSITION_POLL_MS = 900;

const OVAL_RX = 0.3;
const OVAL_RY = 0.42;
const FACE_MIN_HEIGHT_RATIO = 0.28;
const FACE_MAX_HEIGHT_RATIO = 0.95;

type FacePositionStatus = 'unknown' | 'ok' | 'no-face' | 'too-far' | 'too-close' | 'off-center';
type Phase = 'idle' | 'submitting';

// TEMP paused — GuidedStep + STEP_LABELS for turn/smile active liveness UI.

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// TEMP paused — restore with active liveness bursts:
// function sleep(ms: number): Promise<void> {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

function evaluateFacePosition(pos: KycFacePosition | null): {
  status: FacePositionStatus;
  message: string;
} {
  if (!pos || !pos.faceDetected || !pos.normalizedCenter || pos.faceHeightRatio == null) {
    return { status: 'no-face', message: 'Center your face in the oval.' };
  }
  if (pos.faceHeightRatio < FACE_MIN_HEIGHT_RATIO) {
    return { status: 'too-far', message: 'Move a little closer.' };
  }
  if (pos.faceHeightRatio > FACE_MAX_HEIGHT_RATIO) {
    return { status: 'too-close', message: 'Move back slightly.' };
  }
  const dx = (pos.normalizedCenter.x - 0.5) / OVAL_RX;
  const dy = (pos.normalizedCenter.y - 0.5) / OVAL_RY;
  if (dx * dx + dy * dy > 1) {
    return { status: 'off-center', message: 'Center your face in the oval.' };
  }
  return { status: 'ok', message: 'Ready — tap Take selfie when you are.' };
}

/* TEMP paused — restore with active liveness recording:
function pickRecorderMimeType(): string | undefined { ... }
function guidedStepIndex(step: GuidedStep): number { ... }
*/

export function ActiveLivenessCapture({
  onComplete,
  attemptsRemaining,
  attemptsAllowed,
}: {
  onComplete: (out: PostKycLivenessResponse) => void | Promise<void>;
  attemptsRemaining?: number | null;
  attemptsAllowed?: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const pollBusyRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);

  const [faceStatus, setFaceStatus] = useState<FacePositionStatus>('unknown');
  const [faceMessage, setFaceMessage] = useState('Starting camera…');
  const faceOk = faceStatus === 'ok';

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const open = await openUserCamera();
      if (cancelled) {
        if (open.ok) open.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!open.ok) {
        setCameraError(openUserCameraErrorMessage(open.reason));
        return;
      }
      streamRef.current = open.stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = open.stream;
        await video.play().catch(() => undefined);
      }
      setCameraReady(true);
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  const captureOneFrame = useCallback((name: string, fullResolution = false): File | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const scale = fullResolution ? 1 : Math.min(1, CAPTURE_MAX_WIDTH / vw);
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    const quality = fullResolution ? 0.92 : 0.82;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const [head, b64] = dataUrl.split(',');
    const mime = head?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const bin = atob(b64 ?? '');
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
    return new File([u8], name, { type: mime });
  }, []);

  /* TEMP paused — resume with active liveness frame bursts:
  const captureBurst = useCallback(
    async (
      count: number,
      intervalMs: number,
      namePrefix: string,
      onFrame?: (index: number, total: number) => void,
    ): Promise<File[]> => {
      const files: File[] = [];
      for (let i = 0; i < count; i += 1) {
        onFrame?.(i, count);
        const file = captureOneFrame(`${namePrefix}-${i}.jpg`);
        if (file) files.push(file);
        if (i < count - 1) await sleep(intervalMs);
      }
      return files;
    },
    [captureOneFrame],
  );
  */


  useEffect(() => {
    if (!cameraReady || phase !== 'idle') return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || pollBusyRef.current) return;
      const frame = captureOneFrame('position.jpg');
      if (!frame) return;
      pollBusyRef.current = true;
      try {
        const pos = await checkKycFacePosition(frame);
        if (cancelled) return;
        const evaluated = evaluateFacePosition(pos);
        setFaceStatus(evaluated.status);
        setFaceMessage(evaluated.message);
      } catch {
        /* keep last status */
      } finally {
        pollBusyRef.current = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), FACE_POSITION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [cameraReady, phase, captureOneFrame]);

  const handleStart = useCallback(async () => {
    if (runningRef.current) return;
    setRequestError(null);
    if (!cameraReady) {
      setCameraError('Camera is not ready yet.');
      return;
    }

    const gateFrame = captureOneFrame('position.jpg');
    if (gateFrame) {
      try {
        const pos = await checkKycFacePosition(gateFrame);
        const evaluated = evaluateFacePosition(pos);
        setFaceStatus(evaluated.status);
        setFaceMessage(evaluated.message);
        if (evaluated.status !== 'ok') {
          setRequestError(evaluated.message);
          return;
        }
      } catch {
        setRequestError('Could not verify face position. Please try again.');
        return;
      }
    }

    const selfieFile = captureOneFrame('selfie.jpg', true);
    if (!selfieFile) {
      setRequestError('Could not capture your selfie. Please try again.');
      return;
    }

    runningRef.current = true;
    setPhase('submitting');
    setProgress(50);

    try {
      // 1.1 Take selfie → upload
      const selfieOut = await postKycSelfie(selfieFile);
      if (!selfieOut?.success) {
        setRequestError('Selfie upload did not complete. Please try again.');
        setPhase('idle');
        runningRef.current = false;
        return;
      }

      setProgress(80);

      // 1.2 Selfie quality + 2 Aadhaar face match (expression + active liveness paused on server)
      const out = await postKycActiveLiveness({
        frames: [],
        video: null,
        mode: 'smooth',
      });
      if (!out) {
        setRequestError('Empty response from verification. Please try again.');
        setPhase('idle');
        runningRef.current = false;
        return;
      }

      setProgress(100);
      await onComplete(out);
      setPhase('idle');
      setProgress(0);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
      setPhase('idle');
      setProgress(0);
    } finally {
      runningRef.current = false;
    }

    /* TEMP paused — resume active liveness (turn + smile) later:
    runningRef.current = true;
    setPhase('running');
    ... prepare → turn → smile capture bursts, then postKycActiveLiveness with frames/video ...
    */
  }, [cameraReady, captureOneFrame, onComplete]);

  const busy = phase !== 'idle';

  return (
    <div className="grid gap-4">
      {cameraError ? (
        <p className="m-0 text-sm font-bold text-[#991b1b]">{cameraError}</p>
      ) : null}
      {requestError ? (
        <p className="m-0 text-sm font-bold text-[#991b1b]">{requestError}</p>
      ) : null}

      {typeof attemptsRemaining === 'number' && attemptsRemaining > 0 && phase === 'idle' ? (
        <p className="m-0 rounded-xl border border-[rgba(18,36,79,0.1)] bg-white/90 px-3 py-2 text-sm text-brand-navy">
          Verification attempts:{' '}
          <strong>
            {attemptsRemaining}
            {typeof attemptsAllowed === 'number' ? ` of ${attemptsAllowed}` : ''}
          </strong>{' '}
          remaining
        </p>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-[rgba(18,36,79,0.12)] bg-black aspect-[4/3] max-h-[360px]">
        <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" autoPlay playsInline muted />

        {cameraReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={cx(
                'rounded-[50%] border-[3px] transition-colors duration-300',
                faceOk ? 'border-[#22c55e]' : faceStatus === 'unknown' ? 'border-white/75' : 'border-[#ef4444]',
              )}
              style={{ width: '58%', height: '84%', boxShadow: '0 0 0 9999px rgba(6,14,34,0.45)' }}
            />

            {phase === 'idle' ? (
              <span
                className={cx(
                  'absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[0.72rem] font-bold text-white',
                  faceOk ? 'bg-[rgba(22,101,52,0.85)]' : 'bg-[rgba(6,14,34,0.7)]',
                )}
              >
                {faceMessage}
              </span>
            ) : null}
          </div>
        ) : null}

        {phase === 'submitting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[rgba(6,14,34,0.6)] px-4">
            <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-brand-navy">
              Checking selfie quality &amp; matching your Aadhaar photo…
            </span>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-brand-gold transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <button
        type="button"
        disabled={busy || !cameraReady || !faceOk}
        onClick={() => void handleStart()}
        className="mc-btn-primary disabled:opacity-60"
      >
        {phase === 'submitting'
          ? 'Almost done…'
          : faceOk
            ? 'Take selfie'
            : 'Align your face to continue'}
      </button>

      <p className="m-0 text-xs leading-relaxed text-brand-muted">
        Center your face in the oval with good lighting, then tap <strong>Take selfie</strong>. We
        check photo quality and match it to your Aadhaar photo.
      </p>
    </div>
  );
}
