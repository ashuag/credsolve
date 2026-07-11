'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTIVE_LIVENESS_CHALLENGES,
  ACTIVE_LIVENESS_CHALLENGE_LABELS,
  type ActiveLivenessChallenge,
  type ActiveLivenessFacePosition,
  checkActiveLivenessFacePosition,
  type LosActiveLivenessCheckResult,
  runActiveLivenessCheck,
} from '@/lib/api/active-liveness-check';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

const CHALLENGES_PER_RUN = 3;
const FRAMES_PER_CHALLENGE = 14;
const FRAME_INTERVAL_MS = 180;
const CAPTURE_MAX_WIDTH = 480;
const FACE_POSITION_POLL_MS = 800;
// Guide-oval geometry (must match the overlay: 58% width, 84% height, centered).
const OVAL_RX = 0.3;
const OVAL_RY = 0.42;
const FACE_MIN_HEIGHT_RATIO = 0.28;
const FACE_MAX_HEIGHT_RATIO = 0.95;

type FacePositionStatus = 'unknown' | 'ok' | 'no-face' | 'too-far' | 'too-close' | 'off-center';

function evaluateFacePosition(pos: ActiveLivenessFacePosition | null): {
  status: FacePositionStatus;
  message: string;
} {
  if (!pos || !pos.faceDetected || !pos.normalizedCenter || pos.faceHeightRatio == null) {
    return { status: 'no-face', message: 'No face detected — center your face in the oval.' };
  }
  if (pos.faceHeightRatio < FACE_MIN_HEIGHT_RATIO) {
    return { status: 'too-far', message: 'Move closer — your face is too small in the frame.' };
  }
  if (pos.faceHeightRatio > FACE_MAX_HEIGHT_RATIO) {
    return { status: 'too-close', message: 'Move back a little — your face is too close.' };
  }
  const dx = (pos.normalizedCenter.x - 0.5) / OVAL_RX;
  const dy = (pos.normalizedCenter.y - 0.5) / OVAL_RY;
  if (dx * dx + dy * dy > 1) {
    return { status: 'off-center', message: 'Center your face inside the oval.' };
  }
  return { status: 'ok', message: 'Face aligned — you can start.' };
}

type ChallengeOutcome = {
  challenge: ActiveLivenessChallenge;
  result?: LosActiveLivenessCheckResult;
  error?: string;
};

type Phase = 'idle' | 'running' | 'done';
type SubPhase = 'get-ready' | 'capturing' | 'analyzing';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64 ?? '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return new File([u8], name, { type: mime });
}

function pickChallenges(count: number): ActiveLivenessChallenge[] {
  const pool = [...ACTIVE_LIVENESS_CHALLENGES];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

function fmt(value: number | null | undefined, digits = 3): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function ChallengeResultCard({ outcome }: { outcome: ChallengeOutcome }) {
  const [open, setOpen] = useState(false);
  const label = ACTIVE_LIVENESS_CHALLENGE_LABELS[outcome.challenge];
  const passed = outcome.result?.passed ?? false;
  const hasError = Boolean(outcome.error);

  return (
    <div
      className={cx(
        'rounded-[14px] border px-4 py-3',
        hasError
          ? 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)]'
          : passed
            ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)]'
            : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.9rem] font-extrabold text-brand-navy">{label}</span>
        <span
          className={cx(
            'rounded-full px-2.5 py-1 text-[0.72rem] font-bold',
            hasError || !passed ? 'bg-[rgba(239,68,68,0.14)] text-[#991b1b]' : 'bg-[rgba(34,197,94,0.16)] text-[#166534]',
          )}
        >
          {hasError ? 'Error' : passed ? 'Passed' : 'Failed'}
        </span>
      </div>

      <p className="m-0 mt-1.5 text-[0.82rem] leading-[1.5] text-brand-text">
        {outcome.error ?? outcome.result?.reason}
      </p>

      {outcome.result ? (
        <>
          <p className="m-0 mt-1 text-[0.76rem] text-brand-muted">
            {outcome.result.framesWithFace}/{outcome.result.framesAnalyzed} frames with a face
            {outcome.result.validationDisabled ? ' · validation disabled' : ''}
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 cursor-pointer text-[0.76rem] font-bold text-brand-blue underline"
          >
            {open ? 'Hide metrics' : 'Show metrics'}
          </button>
          {open ? (
            <div className="mt-2 grid gap-3">
              {Object.keys(outcome.result.aggregates).length ? (
                <dl className="m-0 grid gap-1 text-[0.76rem] text-brand-muted">
                  {Object.entries(outcome.result.aggregates).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[minmax(0,0.6fr)_1fr] gap-2">
                      <dt>{k}</dt>
                      <dd className="m-0 font-mono text-brand-navy">{fmt(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[0.72rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.1)] text-left text-brand-muted">
                      {['#', 'Face', 'EAR', 'Mouth', 'Smile', 'Yaw'].map((h) => (
                        <th key={h} className="px-2 py-1 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.result.frames.map((f) => (
                      <tr key={f.index} className="border-b border-[rgba(23,44,113,0.05)] font-mono">
                        <td className="px-2 py-1">{f.index}</td>
                        <td className="px-2 py-1">{f.faceDetected ? '✓' : '✕'}</td>
                        <td className="px-2 py-1">{fmt(f.ear)}</td>
                        <td className="px-2 py-1">{fmt(f.mouthOpenRatio)}</td>
                        <td className="px-2 py-1">{fmt(f.smileRatio)}</td>
                        <td className="px-2 py-1">{fmt(f.yaw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <details className="rounded-[10px] border border-[rgba(23,44,113,0.1)] bg-white px-3 py-2">
                <summary className="cursor-pointer text-[0.74rem] font-bold text-brand-navy">Thresholds JSON</summary>
                <pre className="m-0 mt-2 overflow-x-auto text-[0.72rem] text-brand-muted">
                  {JSON.stringify(outcome.result.thresholds, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function ActiveLivenessCheckPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [subPhase, setSubPhase] = useState<SubPhase>('get-ready');
  const [countdown, setCountdown] = useState(0);
  const [challenges, setChallenges] = useState<ActiveLivenessChallenge[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<ChallengeOutcome[]>([]);

  const [faceStatus, setFaceStatus] = useState<FacePositionStatus>('unknown');
  const [faceMessage, setFaceMessage] = useState('Checking camera…');
  const pollBusyRef = useRef(false);
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

  const captureOneFrame = useCallback((name: string): File | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const scale = Math.min(1, CAPTURE_MAX_WIDTH / vw);
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Draw the RAW (un-mirrored) frame so head-turn direction is correct.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return dataUrlToFile(canvas.toDataURL('image/jpeg', 0.8), name);
  }, []);

  const captureFrames = useCallback(async (): Promise<File[]> => {
    const files: File[] = [];
    for (let i = 0; i < FRAMES_PER_CHALLENGE; i += 1) {
      const file = captureOneFrame(`frame-${i}.jpg`);
      if (file) files.push(file);
      await sleep(FRAME_INTERVAL_MS);
    }
    return files;
  }, [captureOneFrame]);

  // While not actively running, poll the server to confirm the face is inside the guide oval.
  useEffect(() => {
    if (!cameraReady || phase === 'running') return;
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
        /* transient — keep last status */
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

  const runChallenge = useCallback(
    async (challenge: ActiveLivenessChallenge, token: string): Promise<ChallengeOutcome> => {
      setSubPhase('get-ready');
      for (let c = 3; c >= 1; c -= 1) {
        setCountdown(c);
        await sleep(650);
      }
      setCountdown(0);
      setSubPhase('capturing');
      const frames = await captureFrames();
      setSubPhase('analyzing');
      try {
        const result = await runActiveLivenessCheck(token, challenge, frames);
        return { challenge, result };
      } catch (err) {
        return { challenge, error: err instanceof Error ? err.message : 'Active liveness check failed.' };
      }
    },
    [captureFrames],
  );

  const handleStart = useCallback(async () => {
    if (runningRef.current) return;
    setRequestError(null);
    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }
    if (!cameraReady) {
      setCameraError('Camera is not ready yet.');
      return;
    }

    // Gate: confirm the face is inside the oval before starting the challenges.
    const gateFrame = captureOneFrame('position.jpg');
    if (gateFrame) {
      try {
        const pos = await checkActiveLivenessFacePosition(token, gateFrame);
        const evaluated = evaluateFacePosition(pos);
        setFaceStatus(evaluated.status);
        setFaceMessage(evaluated.message);
        if (evaluated.status !== 'ok') {
          setRequestError(`Can't start yet — ${evaluated.message}`);
          return;
        }
      } catch {
        setRequestError('Could not verify face position. Please try again.');
        return;
      }
    }

    runningRef.current = true;
    const seq = pickChallenges(CHALLENGES_PER_RUN);
    setChallenges(seq);
    setOutcomes([]);
    setCurrentIndex(0);
    setPhase('running');

    const collected: ChallengeOutcome[] = [];
    for (let i = 0; i < seq.length; i += 1) {
      setCurrentIndex(i);
      const outcome = await runChallenge(seq[i]!, token);
      collected.push(outcome);
      setOutcomes([...collected]);
      await sleep(700);
    }

    setPhase('done');
    runningRef.current = false;
  }, [cameraReady, runChallenge, captureOneFrame]);

  const currentChallenge = challenges[currentIndex];
  const overallPassed =
    phase === 'done' &&
    outcomes.length === challenges.length &&
    outcomes.length > 0 &&
    outcomes.every((o) => o.result?.passed);

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Active (challenge–response) liveness. The tool asks for{' '}
        <strong>{CHALLENGES_PER_RUN} randomized actions</strong> (blink, turn head, smile, open mouth),
        captures a short burst of frames per action, and the server verifies the action actually happened
        using <code className="text-[0.8rem]">face-api</code> landmark geometry (EAR / mouth ratio / yaw).
        Thresholds are tunable via <code className="text-[0.8rem]">ACTIVE_LIVENESS_*</code> env vars.
      </p>

      {cameraError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{cameraError}</p> : null}
      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      <div className="grid gap-4 rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white p-5">
        <div className="relative overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.12)] bg-black aspect-[4/3] max-h-[360px]">
          {/* Mirror for natural UX; raw pixels are captured to canvas regardless. */}
          <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" autoPlay playsInline muted />

          {/* Face-position guide: dims outside a centered oval so the user knows where the face must be. */}
          {cameraReady ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={cx(
                  'rounded-[50%] border-2 transition-colors duration-200',
                  phase === 'running'
                    ? subPhase === 'capturing'
                      ? 'border-brand-gold'
                      : 'border-white/75'
                    : faceOk
                      ? 'border-[#22c55e]'
                      : faceStatus === 'unknown'
                        ? 'border-white/75'
                        : 'border-[#ef4444]',
                )}
                style={{ width: '58%', height: '84%', boxShadow: '0 0 0 9999px rgba(6,14,34,0.45)' }}
              />
              {phase !== 'running' ? (
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

          {phase === 'running' && currentChallenge ? (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-[rgba(6,14,34,0.72)] px-4 py-3 text-center">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/70">
                Step {currentIndex + 1} / {challenges.length}
              </span>
              <span className="text-[1.05rem] font-extrabold text-white">
                {ACTIVE_LIVENESS_CHALLENGE_LABELS[currentChallenge]}
              </span>
              <span className="text-[0.8rem] font-bold text-brand-gold">
                {subPhase === 'get-ready'
                  ? countdown > 0
                    ? `Get ready… ${countdown}`
                    : 'Get ready…'
                  : subPhase === 'capturing'
                    ? 'Do it now! Hold the action…'
                    : 'Analyzing…'}
              </span>
            </div>
          ) : null}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={phase === 'running' || !cameraReady || (phase !== 'done' && !faceOk)}
            onClick={() => void handleStart()}
            className="cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
          >
            {phase === 'running'
              ? 'Running…'
              : phase === 'done'
                ? 'Run again'
                : faceOk
                  ? 'Start liveness test'
                  : 'Align your face to start'}
          </button>
        </div>
      </div>

      {outcomes.length ? (
        <div className="grid gap-3">
          {outcomes.map((outcome, i) => (
            <ChallengeResultCard key={`${outcome.challenge}-${i}`} outcome={outcome} />
          ))}

          {phase === 'done' ? (
            <div
              className={cx(
                'rounded-[14px] border px-4 py-3 text-[0.9rem] font-bold',
                overallPassed
                  ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)] text-[#166534]'
                  : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)] text-[#991b1b]',
              )}
            >
              Overall: {overallPassed ? 'Live person — all challenges passed' : 'Failed — one or more challenges not satisfied'}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
