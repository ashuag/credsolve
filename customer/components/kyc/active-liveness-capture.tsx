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
const PREP_HOLD_MS = 1500;
const PREP_BASELINE_FRAMES = 4;
const PREP_BASELINE_INTERVAL_MS = 500;

/** Dense burst while turning — captures yaw motion clearly. */
const TURN_BURST_FRAMES = 12;
const TURN_FRAME_INTERVAL_MS = 120;

const SMILE_BURST_FRAMES = 12;
const SMILE_FRAME_INTERVAL_MS = 220;

const CAPTURE_MAX_WIDTH = 480;
const FACE_POSITION_POLL_MS = 900;

const OVAL_RX = 0.3;
const OVAL_RY = 0.42;
const FACE_MIN_HEIGHT_RATIO = 0.28;
const FACE_MAX_HEIGHT_RATIO = 0.95;

type FacePositionStatus = 'unknown' | 'ok' | 'no-face' | 'too-far' | 'too-close' | 'off-center';
type Phase = 'idle' | 'running' | 'submitting';

type GuidedStep =
  | 'prepare'
  | 'turn-ready'
  | 'turn-capture'
  | 'smile-ready'
  | 'smile-capture';

const STEP_LABELS: Record<GuidedStep, string> = {
  prepare: 'Get ready',
  'turn-ready': 'Turn head next',
  'turn-capture': 'Turn head now',
  'smile-ready': 'Smile next',
  'smile-capture': 'Smile now',
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  return { status: 'ok', message: 'Ready — tap Start when you are.' };
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

function guidedStepIndex(step: GuidedStep): number {
  if (step === 'prepare') return 0;
  if (step.startsWith('turn')) return 1;
  return 2;
}

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
  const drawLoopRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const pollBusyRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [guidedStep, setGuidedStep] = useState<GuidedStep>('prepare');
  const [progress, setProgress] = useState(0);

  const [faceStatus, setFaceStatus] = useState<FacePositionStatus>('unknown');
  const [faceMessage, setFaceMessage] = useState('Starting camera…');
  const faceOk = faceStatus === 'ok';

  const stopCamera = useCallback(() => {
    if (drawLoopRef.current != null) {
      cancelAnimationFrame(drawLoopRef.current);
      drawLoopRef.current = null;
    }
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
    setPhase('running');
    setProgress(0);
    setGuidedStep('prepare');

    const chunks: Blob[] = [];
    let recorder: MediaRecorder | null = null;
    let recordStream: MediaStream | null = null;
    let recordStreamFromCanvas = false;
    const mimeType = pickRecorderMimeType() ?? 'video/webm';

    const stopDrawLoop = () => {
      if (drawLoopRef.current != null) {
        cancelAnimationFrame(drawLoopRef.current);
        drawLoopRef.current = null;
      }
    };

    const startCanvasRecording = (): MediaRecorder | null => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || typeof MediaRecorder === 'undefined') return null;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;

      const scale = Math.min(1, CAPTURE_MAX_WIDTH / vw);
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const draw = () => {
        if (!runningRef.current) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawLoopRef.current = requestAnimationFrame(draw);
      };
      draw();

      try {
        recordStream = canvas.captureStream(10);
        recordStreamFromCanvas = true;
        const nextRecorder = new MediaRecorder(recordStream, { mimeType });
        nextRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        nextRecorder.start(250);
        return nextRecorder;
      } catch {
        stopDrawLoop();
        recordStream?.getTracks().forEach((track) => track.stop());
        recordStream = null;
        return null;
      }
    };

    recorder = startCanvasRecording();
    if (!recorder && streamRef.current && typeof MediaRecorder !== 'undefined') {
      try {
        recorder = new MediaRecorder(streamRef.current, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.start(250);
      } catch {
        recorder = null;
      }
    }

    const stopRecording = async (): Promise<Blob | null> => {
      stopDrawLoop();
      if (recordStreamFromCanvas) {
        recordStream?.getTracks().forEach((track) => {
          if (track.readyState === 'live') track.stop();
        });
      }
      recordStream = null;
      recordStreamFromCanvas = false;

      if (!recorder || recorder.state === 'inactive') {
        return chunks.length ? new Blob(chunks, { type: mimeType }) : null;
      }
      return new Promise<Blob | null>((resolve) => {
        recorder!.onstop = () =>
          resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null);
        try {
          recorder!.stop();
        } catch {
          resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null);
        }
      });
    };

    const totalFrameBudget = PREP_BASELINE_FRAMES + TURN_BURST_FRAMES + SMILE_BURST_FRAMES;
    let framesCaptured = 0;
    const bumpProgress = () => {
      framesCaptured += 1;
      setProgress(Math.round((framesCaptured / totalFrameBudget) * 100));
    };

    try {
      // Step 1 — hold still with eyes open (message first, light baseline capture at end).
      setGuidedStep('prepare');
      await sleep(PREP_HOLD_MS - PREP_BASELINE_FRAMES * PREP_BASELINE_INTERVAL_MS);

      const baselineFrames = await captureBurst(
        PREP_BASELINE_FRAMES,
        PREP_BASELINE_INTERVAL_MS,
        'baseline',
        () => bumpProgress(),
      );

      // Step 2 — turn head (left or right): instruction then dense capture.
      setGuidedStep('turn-ready');
      await sleep(800);

      setGuidedStep('turn-capture');
      const turnFrames = await captureBurst(
        TURN_BURST_FRAMES,
        TURN_FRAME_INTERVAL_MS,
        'turn',
        () => bumpProgress(),
      );

      // Step 3 — smile: instruction then capture.
      setGuidedStep('smile-ready');
      await sleep(800);

      setGuidedStep('smile-capture');
      const smileFrames = await captureBurst(
        SMILE_BURST_FRAMES,
        SMILE_FRAME_INTERVAL_MS,
        'smile',
        () => bumpProgress(),
      );

      const allFrames = [...baselineFrames, ...turnFrames, ...smileFrames];
      if (allFrames.length < 8) {
        setRequestError('Could not capture enough frames. Please try again.');
        setPhase('idle');
        setGuidedStep('prepare');
        runningRef.current = false;
        return;
      }

      setPhase('submitting');
      setProgress(100);
      const video = await stopRecording();

      const selfieOut = await postKycSelfie(selfieFile);
      if (!selfieOut?.success) {
        setRequestError('Selfie upload did not complete. Please try again.');
        setPhase('idle');
        setGuidedStep('prepare');
        runningRef.current = false;
        return;
      }

      const out = await postKycActiveLiveness({
        frames: allFrames,
        video,
        mode: 'smooth',
        smoothSegments: [
          { phase: 'baseline', count: baselineFrames.length },
          { phase: 'turn', count: turnFrames.length },
          { phase: 'smile', count: smileFrames.length },
        ],
      });
      if (!out) {
        setRequestError('Empty response from the liveness check. Please try again.');
        setPhase('idle');
        setGuidedStep('prepare');
        runningRef.current = false;
        return;
      }

      await onComplete(out);
      setPhase('idle');
      setGuidedStep('prepare');
      setProgress(0);
    } catch (err) {
      try {
        await stopRecording();
      } catch {
        /* ignore */
      }
      setRequestError(err instanceof Error ? err.message : 'Liveness check failed. Please try again.');
      setPhase('idle');
      setGuidedStep('prepare');
      setProgress(0);
    } finally {
      runningRef.current = false;
    }
  }, [cameraReady, captureBurst, captureOneFrame, onComplete]);

  const busy = phase !== 'idle';
  const activeStep = phase === 'running' ? guidedStepIndex(guidedStep) : -1;

  const overlayTitle =
    phase === 'running'
      ? guidedStep === 'prepare'
        ? 'Look at the camera'
        : guidedStep === 'turn-ready'
          ? 'Get ready to turn'
          : guidedStep === 'turn-capture'
            ? 'TURN YOUR HEAD'
            : guidedStep === 'smile-ready'
              ? 'Get ready to smile'
              : guidedStep === 'smile-capture'
                ? 'SMILE NOW'
                : null
      : null;

  const overlayHint =
    phase === 'running'
      ? guidedStep === 'prepare'
        ? 'Keep your face in the oval. Look straight ahead.'
        : guidedStep === 'turn-ready'
          ? 'Turn your head to the left or right when you see TURN YOUR HEAD.'
          : guidedStep === 'turn-capture'
            ? 'Turn slowly — either direction is fine. Keep your face in the oval.'
            : guidedStep === 'smile-ready'
              ? 'Relax your face — smile naturally when you see SMILE NOW.'
              : guidedStep === 'smile-capture'
                ? 'Hold your smile for a moment.'
                : null
      : null;

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
                phase === 'running' && guidedStep.startsWith('turn')
                  ? 'border-[#f59e0b]'
                  : phase === 'running' && guidedStep.includes('smile')
                    ? 'border-[#22c55e]'
                    : phase === 'running'
                      ? 'border-brand-gold'
                      : faceOk
                        ? 'border-[#22c55e]'
                        : faceStatus === 'unknown'
                          ? 'border-white/75'
                          : 'border-[#ef4444]',
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

            {phase === 'running' && overlayTitle ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                <span
                  className={cx(
                    'text-[1.35rem] font-extrabold uppercase tracking-wide text-white drop-shadow-md',
                    guidedStep === 'turn-capture' || guidedStep === 'smile-capture'
                      ? 'text-[1.55rem]'
                      : undefined,
                  )}
                >
                  {overlayTitle}
                </span>
                {overlayHint ? (
                  <span className="max-w-[280px] text-[0.82rem] font-semibold text-white/90">
                    {overlayHint}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === 'running' ? (
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-[rgba(6,14,34,0.88)] px-4 py-3 text-center">
            <div className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-white/80">
              {(['Prepare', 'Turn head', 'Smile'] as const).map((label, index) => (
                <span
                  key={label}
                  className={cx(
                    'rounded-full px-2.5 py-1',
                    activeStep === index
                      ? 'bg-brand-gold text-brand-navy'
                      : activeStep > index
                        ? 'bg-[rgba(34,197,94,0.35)] text-white'
                        : 'bg-white/10 text-white/60',
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
            <span className="text-[0.78rem] font-semibold text-white/75">{STEP_LABELS[guidedStep]}</span>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-brand-gold transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {phase === 'submitting' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(6,14,34,0.6)]">
            <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-brand-navy">
              Checking liveness &amp; matching your Aadhaar photo…
            </span>
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
        {phase === 'running'
          ? 'Follow the prompts on screen…'
          : phase === 'submitting'
            ? 'Almost done…'
            : faceOk
              ? 'Start verification'
              : 'Align your face to start'}
      </button>

      <p className="m-0 text-xs leading-relaxed text-brand-muted">
        We will guide you step by step: hold still facing the camera, turn your head to the left
        or right when prompted, then smile when we say <strong>SMILE NOW</strong>. Either direction
        is fine — turn slowly and keep your face in the oval.
      </p>
    </div>
  );
}
