'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ActiveLivenessFacePosition,
  type LosActiveLivenessCheckResult,
  checkActiveLivenessFacePosition,
  runSmoothActiveLivenessCheck,
} from '@/lib/api/active-liveness-check';
import { runKycSelfieFaceCheck, type LosSelfieFaceCheckResult } from '@/lib/api/kyc-selfie-face-check';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';
import { KYC_FACE_PIPELINE_STEP_LABELS } from '@/lib/kyc-pipeline-steps';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

/** Mirror customer `active-liveness-capture.tsx` timing. */
const PREP_HOLD_MS = 2000;
const PREP_BASELINE_FRAMES = 4;
const PREP_BASELINE_INTERVAL_MS = 500;
const COUNTDOWN_SECONDS = 3;
const COUNTDOWN_TICK_MS = 1000;
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

/** Customer KYC face pipeline minus Aadhaar face match. */
const DEMO_PIPELINE_STEPS = [
  KYC_FACE_PIPELINE_STEP_LABELS[0],
  KYC_FACE_PIPELINE_STEP_LABELS[2],
  KYC_FACE_PIPELINE_STEP_LABELS[3],
] as const;

type FacePositionStatus = 'unknown' | 'ok' | 'no-face' | 'too-far' | 'too-close' | 'off-center';
type Phase = 'idle' | 'running' | 'submitting' | 'done';
type GuidedStep =
  | 'prepare'
  | 'turn-ready'
  | 'turn-countdown'
  | 'turn-capture'
  | 'smile-ready'
  | 'smile-countdown'
  | 'smile-capture';

const STEP_LABELS: Record<GuidedStep, string> = {
  prepare: 'Get ready',
  'turn-ready': 'Turn head next',
  'turn-countdown': 'Turn head soon',
  'turn-capture': 'Turn head now',
  'smile-ready': 'Smile next',
  'smile-countdown': 'Smile soon',
  'smile-capture': 'Smile now',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function evaluateFacePosition(pos: ActiveLivenessFacePosition | null): {
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

function guidedStepIndex(step: GuidedStep): number {
  if (step === 'prepare') return 0;
  if (step.startsWith('turn')) return 1;
  return 2;
}

function fmt(value: number | null | undefined | boolean | string, digits = 3): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function PipelineStepCard({
  label,
  stepNumber,
  status,
  summary,
  detail,
}: {
  label: string;
  stepNumber: number;
  status: 'pending' | 'ok' | 'fail' | 'skipped';
  summary: string;
  detail?: string;
}) {
  return (
    <div
      className={cx(
        'rounded-[14px] border px-4 py-3',
        status === 'ok'
          ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)]'
          : status === 'fail'
            ? 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)]'
            : 'border-[rgba(23,44,113,0.1)] bg-white',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(20,150,243,0.12)] text-[0.72rem] font-extrabold text-[#1496f3]">
            {stepNumber}
          </span>
          <span className="text-[0.9rem] font-extrabold text-brand-navy">{label}</span>
        </div>
        <span
          className={cx(
            'rounded-full px-2.5 py-1 text-[0.72rem] font-bold',
            status === 'ok'
              ? 'bg-[rgba(34,197,94,0.16)] text-[#166534]'
              : status === 'fail'
                ? 'bg-[rgba(239,68,68,0.14)] text-[#991b1b]'
                : status === 'skipped'
                  ? 'bg-[rgba(23,44,113,0.08)] text-brand-muted'
                  : 'bg-[rgba(23,44,113,0.08)] text-brand-muted',
          )}
        >
          {status === 'ok' ? 'Passed' : status === 'fail' ? 'Failed' : status === 'skipped' ? 'Skipped' : 'Pending'}
        </span>
      </div>
      <p className="m-0 mt-1.5 text-[0.82rem] leading-[1.5] text-brand-text">{summary}</p>
      {detail ? <p className="m-0 mt-1 text-[0.76rem] text-brand-muted">{detail}</p> : null}
    </div>
  );
}

export function ActiveLivenessCheckPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const pollBusyRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [guidedStep, setGuidedStep] = useState<GuidedStep>('prepare');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const [faceStatus, setFaceStatus] = useState<FacePositionStatus>('unknown');
  const [faceMessage, setFaceMessage] = useState('Starting camera…');
  const faceOk = faceStatus === 'ok';

  const [selfieResult, setSelfieResult] = useState<LosSelfieFaceCheckResult | null>(null);
  const [livenessResult, setLivenessResult] = useState<LosActiveLivenessCheckResult | null>(null);
  const [metricsOpen, setMetricsOpen] = useState(false);

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
    // Match customer capture: mirror so on-screen and uploaded frames agree.
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
      onFrame?: () => void,
    ): Promise<File[]> => {
      const files: File[] = [];
      for (let i = 0; i < count; i += 1) {
        onFrame?.();
        const file = captureOneFrame(`${namePrefix}-${i}.jpg`);
        if (file) files.push(file);
        if (i < count - 1) await sleep(intervalMs);
      }
      return files;
    },
    [captureOneFrame],
  );

  const runCountdown = useCallback(async (step: GuidedStep): Promise<void> => {
    setGuidedStep(step);
    for (let n = COUNTDOWN_SECONDS; n >= 1; n -= 1) {
      setCountdown(n);
      await sleep(COUNTDOWN_TICK_MS);
    }
    setCountdown(null);
  }, []);

  useEffect(() => {
    if (!cameraReady || phase !== 'idle') return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || pollBusyRef.current) return;
      const token = getLosToken();
      if (!token) return;
      const frame = captureOneFrame('position.jpg');
      if (!frame) return;
      pollBusyRef.current = true;
      try {
        const pos = await checkActiveLivenessFacePosition(token, frame);
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
    setSelfieResult(null);
    setLivenessResult(null);
    setMetricsOpen(false);

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }
    if (!cameraReady) {
      setCameraError('Camera is not ready yet.');
      return;
    }

    const gateFrame = captureOneFrame('position.jpg');
    if (gateFrame) {
      try {
        const pos = await checkActiveLivenessFacePosition(token, gateFrame);
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
      setRequestError('Could not capture selfie. Please try again.');
      return;
    }

    runningRef.current = true;
    setPhase('running');
    setProgress(0);
    setCountdown(null);
    setGuidedStep('prepare');

    const totalFrameBudget = PREP_BASELINE_FRAMES + TURN_BURST_FRAMES + SMILE_BURST_FRAMES;
    let framesCaptured = 0;
    const bumpProgress = () => {
      framesCaptured += 1;
      setProgress(Math.round((framesCaptured / totalFrameBudget) * 100));
    };

    try {
      setGuidedStep('prepare');
      await sleep(PREP_HOLD_MS - PREP_BASELINE_FRAMES * PREP_BASELINE_INTERVAL_MS);

      const baselineFrames = await captureBurst(
        PREP_BASELINE_FRAMES,
        PREP_BASELINE_INTERVAL_MS,
        'baseline',
        bumpProgress,
      );

      setGuidedStep('turn-ready');
      await sleep(600);
      await runCountdown('turn-countdown');

      setGuidedStep('turn-capture');
      const turnFrames = await captureBurst(
        TURN_BURST_FRAMES,
        TURN_FRAME_INTERVAL_MS,
        'turn',
        bumpProgress,
      );

      setGuidedStep('smile-ready');
      await sleep(500);
      await runCountdown('smile-countdown');

      setGuidedStep('smile-capture');
      const smileFrames = await captureBurst(
        SMILE_BURST_FRAMES,
        SMILE_FRAME_INTERVAL_MS,
        'smile',
        bumpProgress,
      );

      const allFrames = [...baselineFrames, ...turnFrames, ...smileFrames];
      if (allFrames.length < 8) {
        setRequestError('Could not capture enough frames. Please try again.');
        setPhase('idle');
        setGuidedStep('prepare');
        setCountdown(null);
        runningRef.current = false;
        return;
      }

      setPhase('submitting');
      setProgress(100);
      setCountdown(null);

      const selfieOut = await runKycSelfieFaceCheck(token, selfieFile);
      setSelfieResult(selfieOut);

      const livenessOut = await runSmoothActiveLivenessCheck(token, allFrames, [
        { phase: 'baseline', count: baselineFrames.length },
        { phase: 'turn', count: turnFrames.length },
        { phase: 'smile', count: smileFrames.length },
      ]);
      setLivenessResult(livenessOut);
      setPhase('done');
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'KYC dry-run failed. Please try again.');
      setPhase('idle');
      setGuidedStep('prepare');
      setCountdown(null);
      setProgress(0);
    } finally {
      runningRef.current = false;
    }
  }, [cameraReady, captureBurst, captureOneFrame, runCountdown]);

  const busy = phase === 'running' || phase === 'submitting';
  const activeStep = phase === 'running' ? guidedStepIndex(guidedStep) : -1;

  const overlayTitle =
    phase === 'running' && countdown != null
      ? String(countdown)
      : phase === 'running'
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
                  : guidedStep === 'turn-countdown'
                    ? 'Turn in…'
                    : 'Smile in…'
        : null;

  const overlayHint =
    phase === 'running'
      ? guidedStep === 'prepare'
        ? 'Keep your face in the oval. Look straight ahead.'
        : guidedStep === 'turn-ready' || guidedStep === 'turn-countdown'
          ? 'We will count down — turn your head to the left or right when you see TURN YOUR HEAD.'
          : guidedStep === 'turn-capture'
            ? 'Turn slowly — either direction is fine. Keep your face in the oval.'
            : guidedStep === 'smile-ready' || guidedStep === 'smile-countdown'
              ? 'Relax your face — smile naturally when you see SMILE NOW.'
              : guidedStep === 'smile-capture'
                ? 'Hold your smile for a moment.'
                : null
      : null;

  const selfiePassed = selfieResult?.local.ok === true;
  const expression = livenessResult?.expressionAntiSpoof;
  const expressionPassed = expression?.passed === true;
  // Smooth analysis sets overall `passed = liveness && expression`. If overall fails with the
  // expression reason, active liveness itself still passed.
  const activeStepPassed = (() => {
    if (!livenessResult) return false;
    if (!expression) return livenessResult.passed;
    if (livenessResult.passed) return true;
    return !expression.passed && livenessResult.reason === expression.reason;
  })();
  const activeStepSummary = (() => {
    if (!livenessResult) return 'Not run';
    if (!expression) return livenessResult.reason;
    if (!expression.passed && livenessResult.reason === expression.reason) {
      return 'Head movement and smile detected (overall blocked by expression check).';
    }
    return livenessResult.reason;
  })();

  const overallOk = phase === 'done' && selfiePassed && Boolean(livenessResult?.passed);

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Dry-run of the <strong>customer KYC face flow</strong> (same prompts: prepare → turn head → smile),
        including selfie quality, expression anti-spoof, and smooth active liveness.{' '}
        <strong>Aadhaar face match is omitted</strong> — use the Face Match Check tool for that.
      </p>

      <div className="grid gap-2">
        <p className="m-0 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
          Verification steps (no face match)
        </p>
        <ol className="m-0 grid list-none gap-2 p-0">
          {DEMO_PIPELINE_STEPS.map((label, index) => (
            <li
              key={label}
              className="flex items-start gap-2.5 rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white px-3 py-2 text-[0.84rem]"
            >
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(20,150,243,0.12)] text-[0.72rem] font-extrabold text-[#1496f3]">
                {index + 1}
              </span>
              <span className="font-semibold text-brand-navy">{label}</span>
            </li>
          ))}
        </ol>
      </div>

      {cameraError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{cameraError}</p> : null}
      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      <div className="grid gap-4 rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white p-5">
        <div className="relative overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.12)] bg-black aspect-[4/3] max-h-[360px]">
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

              {phase === 'idle' || phase === 'done' ? (
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
                  {countdown != null ? (
                    <span className="text-[3.5rem] font-black leading-none text-white drop-shadow-lg">
                      {countdown}
                    </span>
                  ) : (
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
                  )}
                  {overlayHint ? (
                    <span className="max-w-[280px] text-[0.82rem] font-semibold text-white/90">{overlayHint}</span>
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
                Checking selfie quality, expressions &amp; liveness…
              </span>
            </div>
          ) : null}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !cameraReady || (phase !== 'done' && !faceOk)}
            onClick={() => void handleStart()}
            className="cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
          >
            {phase === 'running'
              ? 'Follow the prompts…'
              : phase === 'submitting'
                ? 'Analyzing…'
                : phase === 'done'
                  ? 'Run again'
                  : faceOk
                    ? 'Start customer KYC flow'
                    : 'Align your face to start'}
          </button>
        </div>

        <p className="m-0 text-[0.76rem] leading-relaxed text-brand-muted">
          Same guidance as customer KYC: hold still facing the camera, turn your head left or right when
          prompted, then smile on <strong>SMILE NOW</strong>. Face match is not run here.
        </p>
      </div>

      {phase === 'done' && (selfieResult || livenessResult) ? (
        <div className="grid gap-3">
          <PipelineStepCard
            stepNumber={1}
            label={DEMO_PIPELINE_STEPS[0]}
            status={selfieResult ? (selfiePassed ? 'ok' : 'fail') : 'pending'}
            summary={
              selfieResult
                ? selfiePassed
                  ? selfieResult.local.reason || 'Selfie quality passed.'
                  : selfieResult.local.reason || 'Selfie quality failed.'
                : 'Not run'
            }
            detail={
              selfieResult?.local.confidenceBreakdown
                ? `Detection ${fmt(selfieResult.local.confidenceBreakdown.detection, 2)} · alignment ${fmt(selfieResult.local.confidenceBreakdown.landmarkAlignment, 2)}`
                : undefined
            }
          />

          <PipelineStepCard
            stepNumber={2}
            label={DEMO_PIPELINE_STEPS[1]}
            status={
              expression
                ? expressionPassed
                  ? 'ok'
                  : 'fail'
                : livenessResult
                  ? 'skipped'
                  : 'pending'
            }
            summary={
              expression?.reason ??
              (livenessResult ? 'Expression anti-spoof not returned.' : 'Not run')
            }
          />

          <PipelineStepCard
            stepNumber={3}
            label={DEMO_PIPELINE_STEPS[2]}
            status={livenessResult ? (activeStepPassed ? 'ok' : 'fail') : 'pending'}
            summary={activeStepSummary}
            detail={
              livenessResult
                ? `${livenessResult.framesWithFace}/${livenessResult.framesAnalyzed} frames with a face${
                    livenessResult.validationDisabled ? ' · validation disabled' : ''
                  }`
                : undefined
            }
          />

          <div
            className={cx(
              'rounded-[14px] border px-4 py-3 text-[0.9rem] font-bold',
              overallOk
                ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)] text-[#166534]'
                : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)] text-[#991b1b]',
            )}
          >
            Overall (without face match):{' '}
            {overallOk ? 'Would pass customer KYC face checks' : 'Would fail — see steps above'}
          </div>

          {livenessResult ? (
            <>
              <button
                type="button"
                onClick={() => setMetricsOpen((v) => !v)}
                className="cursor-pointer justify-self-start text-[0.76rem] font-bold text-brand-blue underline"
              >
                {metricsOpen ? 'Hide metrics' : 'Show metrics'}
              </button>
              {metricsOpen ? (
                <div className="grid gap-3 rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white p-4">
                  {Object.keys(livenessResult.aggregates).length ? (
                    <dl className="m-0 grid gap-1 text-[0.76rem] text-brand-muted">
                      {Object.entries(livenessResult.aggregates).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[minmax(0,0.6fr)_1fr] gap-2">
                          <dt>{k}</dt>
                          <dd className="m-0 font-mono text-brand-navy">{fmt(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {expression?.aggregates && Object.keys(expression.aggregates).length ? (
                    <dl className="m-0 grid gap-1 text-[0.76rem] text-brand-muted">
                      <p className="m-0 mb-1 text-[0.72rem] font-bold uppercase tracking-wide text-brand-navy">
                        Expression aggregates
                      </p>
                      {Object.entries(expression.aggregates).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[minmax(0,0.6fr)_1fr] gap-2">
                          <dt>{k}</dt>
                          <dd className="m-0 font-mono text-brand-navy">{fmt(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <details className="rounded-[10px] border border-[rgba(23,44,113,0.1)] bg-white px-3 py-2">
                    <summary className="cursor-pointer text-[0.74rem] font-bold text-brand-navy">
                      Thresholds JSON
                    </summary>
                    <pre className="m-0 mt-2 overflow-x-auto text-[0.72rem] text-brand-muted">
                      {JSON.stringify(livenessResult.thresholds, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
