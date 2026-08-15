'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import {
  JourneyProgressProvider,
  useJourneyProgressOptional,
} from '@/components/journey/journey-progress-context';
import { KycJourneyShell } from '@/components/kyc/kyc-journey-shell';
import styles from '@/components/kyc/kyc-hub-flow.module.css';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import {
  getCustomerJourneyResumePath,
  isKycHeadMovementPending,
} from '@/lib/api/customer-session';
import {
  pickLivenessFailureUserMessage,
  postKycLiveness,
  postKycLivenessVideo,
  postKycSelfie,
  type KycPhotoQualitySummary,
} from '@/lib/api/kyc-face';
import { formatAddressForDisplay } from '@/lib/format-address';
import { kycJourneyProgressFromSession } from '@/lib/kyc-journey-progress';
import { clearDigilockerExpectSelfie } from '@/lib/api/digilocker';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';
import {
  headMovementRecordingErrorMessage,
  isHeadMovementRecordingSupported,
  recordHeadMovement,
} from '@/lib/media/record-head-movement';

/** Camera stays open through the head-movement recording, then closes for the liveness call. */
type CapturePhase = 'selfie' | 'head-movement' | 'done';

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64 ?? '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return new File([u8], name, { type: mime });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pickFormString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function digilockerAadhaarIdentityBag(form: unknown): {
  name: string | null;
  dob: string | null;
  gender: string | null;
  fullAddress: string | null;
} {
  if (!isRecord(form)) {
    return { name: null, dob: null, gender: null, fullAddress: null };
  }
  const nested = isRecord(form.aadhaar_xml_data) ? form.aadhaar_xml_data : null;
  const bag = nested ?? form;

  const name =
    pickFormString(bag, ['full_name', 'fullName', 'name']) ??
    pickFormString(form, ['full_name', 'fullName', 'name']);
  const dobRaw =
    pickFormString(bag, ['dob', 'date_of_birth', 'dateOfBirth']) ??
    pickFormString(form, ['dob', 'date_of_birth', 'dateOfBirth']);
  const genderRaw =
    pickFormString(bag, ['gender']) ?? pickFormString(form, ['gender']);
  const fullAddress =
    pickFormString(bag, ['full_address', 'fullAddress', 'address']) ??
    pickFormString(form, ['full_address', 'fullAddress', 'address']);

  return {
    name,
    dob: formatDobDdMmYyyy(dobRaw),
    gender: formatAadhaarGenderLabel(genderRaw),
    fullAddress: formatAddressForDisplay(fullAddress),
  };
}

/** DigiLocker / Surepass DOB → `dd-mm-yyyy`. */
function formatDobDdMmYyyy(raw: string | null): string | null {
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(raw.trim());
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  return raw.trim();
}

function formatAadhaarGenderLabel(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim().toUpperCase();
  if (value === 'M' || value === 'MALE') return 'Male';
  if (value === 'F' || value === 'FEMALE') return 'Female';
  if (value === 'T' || value === 'O' || value === 'OTHER' || value === 'OTHERS') return 'Others';
  return raw.trim();
}

function KycSelfieContent() {
  const router = useRouter();
  const journey = useJourneyProgressOptional();
  const { loading, session, refresh } = useCustomerSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  /** Open webcam only while capturing; not after a saved selfie (avoids permission prompts on refresh / return visits). */
  const [retakeSelfie, setRetakeSelfie] = useState(false);
  /**
   * Holds the webcam open across the face checks that run straight after capture, so a pass
   * flows into the head-movement recording on the same stream instead of reopening the camera.
   */
  const [holdCamera, setHoldCamera] = useState(false);
  const [phase, setPhase] = useState<CapturePhase>('selfie');
  const [recordingPct, setRecordingPct] = useState(0);
  const [selfieQuality, setSelfieQuality] = useState<KycPhotoQualitySummary | null>(null);
  const [headMovementScore, setHeadMovementScore] = useState<number | null>(null);

  const navigatingRef = useRef(false);
  /** Verifies a previously saved selfie once per visit, not on every session refresh. */
  const autoVerifyRef = useRef(false);

  const { progressPct } = useMemo(
    () => kycJourneyProgressFromSession(session),
    [session],
  );

  useEffect(() => {
    journey?.setCompletion01(progressPct / 100);
  }, [journey, progressPct]);

  useEffect(() => {
    clearDigilockerExpectSelfie();
  }, []);

  const kyc = session?.authenticated === true ? session.kycFaceProgress : null;
  const photoHref =
    kyc?.digilockerAadhaarPhotoUrl && session?.authenticated === true
      ? `/api${kyc.digilockerAadhaarPhotoUrl}`
      : null;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const selfieAlreadySaved = kyc?.selfieCaptured === true;
  const cameraNeededForSelfie = !selfieAlreadySaved || retakeSelfie;
  const needsWebcamStream =
    !loading &&
    session?.authenticated === true &&
    kyc != null &&
    phase !== 'done' &&
    (cameraNeededForSelfie || phase === 'head-movement' || holdCamera);

  useEffect(() => {
    let cancelled = false;

    if (!needsWebcamStream) {
      stopCamera();
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const result = await openUserCamera();
      if (cancelled) {
        if (result.ok) result.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!result.ok) {
        setError(openUserCameraErrorMessage(result.reason));
        return;
      }

      const { stream } = result;
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setCameraReady(true);
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [needsWebcamStream, stopCamera]);

  async function continueToNextStep() {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    const next = await refresh();
    if (!next.authenticated) {
      navigatingRef.current = false;
      return;
    }
    router.replace(getCustomerJourneyResumePath(next));
  }

  /**
   * A selfie saved on an earlier visit still needs the head-movement clip. Without this the
   * step is only reachable in the same browser session that uploaded the selfie.
   */
  const headMovementPending = isKycHeadMovementPending(kyc);

  useEffect(() => {
    if (loading || busy || session?.authenticated !== true || retakeSelfie) return;
    if (phase === 'head-movement' || headMovementPending) return;
    const progress = session.kycFaceProgress;
    if (!progress?.selfieCaptured) return;
    if (progress.livenessRequired === false || progress.livenessPassed) {
      void continueToNextStep();
    }
  }, [loading, busy, session, retakeSelfie, phase, headMovementPending]);

  /**
   * The face pipeline already accepted this selfie, so the clip is the only gate left. Re-running
   * the pipeline would return "already complete" and skip straight past the recording.
   */
  useEffect(() => {
    if (loading || busy || retakeSelfie) return;
    if (phase !== 'selfie' || !headMovementPending) return;
    if (kyc?.livenessPassed !== true) return;
    setPhase('head-movement');
  }, [loading, busy, retakeSelfie, phase, headMovementPending, kyc?.livenessPassed]);

  /**
   * A selfie saved on an earlier visit has not been through the gates in this browser session.
   * Verify it in order on arrival so a photo problem is reported before the head-movement card,
   * rather than letting the customer record a clip against a selfie that cannot pass.
   */
  useEffect(() => {
    if (loading || busy || retakeSelfie || autoVerifyRef.current) return;
    if (session?.authenticated !== true || phase !== 'selfie') return;
    const progress = session.kycFaceProgress;
    if (!progress?.selfieCaptured) return;
    if (progress.livenessRequired === false || progress.livenessPassed) return;

    autoVerifyRef.current = true;
    void (async () => {
      setBusy(true);
      setBusyLabel('Checking your photo and matching with Aadhaar…');
      try {
        if ((await runFaceChecks()) !== 'passed') return;
        setPhase('done');
        await continueToNextStep();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Face verification failed.');
      } finally {
        setBusy(false);
        setBusyLabel('');
      }
    })();
  }, [loading, busy, retakeSelfie, session, phase]);

  /**
   * Photo quality first, then the Aadhaar face match, then head movement — the same order the
   * server applies. A photo problem is reported before the customer is asked for a recording.
   */
  async function runFaceChecks(): Promise<'passed' | 'head-movement' | 'failed'> {
    const out = await postKycLiveness();
    if (!out) {
      setError('Empty response from liveness.');
      return 'failed';
    }
    if (!out.configured) {
      setError(out.skipReason ?? 'Liveness is not configured on the server.');
      return 'failed';
    }

    if (out.suggestRetryHeadMovement) {
      // Photo checks and the Aadhaar match passed; only the clip is outstanding.
      setSelfieQuality(null);
      setHeadMovementScore(out.headMovementScore ?? null);
      setPhase('head-movement');
      // Nothing has been recorded yet on a first pass, so the card's instructions are enough.
      setError(out.headMovementCaptured ? (out.headMovementMessage ?? '') : '');
      return 'head-movement';
    }

    if (out.livenessPassed) {
      setSelfieQuality(null);
      return 'passed';
    }

    // Quality or match failed: surface the specific reason and reopen the camera to retry.
    setSelfieQuality(out.selfieQuality ?? null);
    setError(pickLivenessFailureUserMessage(out));
    if (
      out.suggestRetrySelfie ||
      out.faceValidationPassed === false ||
      out.faceMatchPassed === false
    ) {
      setPhase('selfie');
      setRetakeSelfie(true);
    }
    await refresh();
    return 'failed';
  }

  async function handleCapture() {
    setError('');
    setSelfieQuality(null);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) {
      setError('Camera is not ready yet.');
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError('Video has no dimensions yet — wait a moment and try again.');
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Could not read from camera.');
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    setBusy(true);
    setHoldCamera(true);
    setBusyLabel('Saving selfie…');
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const file = dataUrlToFile(dataUrl, 'selfie.jpg');
      const out = await postKycSelfie(file);
      if (!out?.success) {
        setError('Selfie upload did not complete.');
        return;
      }
      setRetakeSelfie(false);
      setHeadMovementScore(null);
      setRecordingPct(0);
      await refresh();

      // Quality, then Aadhaar match. Head-movement instructions only after both pass.
      setBusyLabel('Checking your photo and matching with Aadhaar…');
      const outcome = await runFaceChecks();
      if (outcome === 'passed') {
        setPhase('done');
        await continueToNextStep();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Selfie upload failed.';
      setError(msg);
    } finally {
      setBusy(false);
      setHoldCamera(false);
      setBusyLabel('');
    }
  }

  async function finishAfterHeadMovement() {
    const refreshed = await refresh();
    if (!refreshed.authenticated) return;

    // Head movement was the only outstanding check: the face pipeline already ran for this
    // selfie, and re-running it would be rejected as an already-complete step.
    if (refreshed.kycFaceProgress?.livenessPassed !== true) {
      setBusyLabel('Running face checks…');
      // A failure here keeps the camera and the current stage, so the customer can retry.
      if ((await runFaceChecks()) !== 'passed') return;
    }

    setPhase('done');
    stopCamera();
    await continueToNextStep();
  }

  async function handleHeadMovement() {
    setError('');
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) {
      setError('Camera is not ready yet.');
      return;
    }
    const stream = streamRef.current;
    if (!stream) {
      setError('Camera stream is no longer available. Reload the page and try again.');
      return;
    }
    if (!isHeadMovementRecordingSupported()) {
      setError(headMovementRecordingErrorMessage('unsupported'));
      return;
    }

    setBusy(true);
    setBusyLabel('Recording — keep moving your head…');
    setRecordingPct(0);
    try {
      const result = await recordHeadMovement({
        stream,
        video,
        canvas,
        onProgress: (elapsedMs, durationMs) =>
          setRecordingPct(Math.round((elapsedMs / durationMs) * 100)),
      });
      if (!result.ok) {
        setError(headMovementRecordingErrorMessage(result.reason));
        return;
      }

      setBusyLabel('Checking your head movement…');
      const out = await postKycLivenessVideo(
        result.recording.videoFile,
        result.recording.frameFiles,
      );
      if (!out?.success) {
        setError('Head-movement upload did not complete.');
        return;
      }

      setHeadMovementScore(out.score);
      if (!out.passed) {
        setError(out.reason ?? 'We did not detect enough head movement. Please record again.');
        return;
      }

      setBusyLabel('Running face checks…');
      await finishAfterHeadMovement();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Head-movement check failed.');
    } finally {
      setBusy(false);
      setBusyLabel('');
      setRecordingPct(0);
    }
  }

  async function handleLiveness() {
    setError('');
    setBusy(true);
    setBusyLabel('Checking your photo and matching with Aadhaar…');
    try {
      if ((await runFaceChecks()) !== 'passed') return;
      setPhase('done');
      await continueToNextStep();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liveness request failed.');
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  }

  if (loading || !session || session.authenticated !== true) {
    return (
      <KycJourneyShell
        mobileStepLabel="Selfie"
        mobileOnBack={() => router.push('/kyc')}
        journeyPanel={
          <div className="flex min-h-[40vh] items-center justify-center">
            <Spinner size={36} />
          </div>
        }
      />
    );
  }

  const livenessRetryNeeded =
    kyc?.selfieCaptured === true &&
    kyc.livenessRequired !== false &&
    kyc.livenessPassed !== true;

  function handleRetakeSelfie() {
    setError('');
    setSelfieQuality(null);
    setHeadMovementScore(null);
    setPhase('selfie');
    setRetakeSelfie(true);
  }

  const form = kyc?.digilockerAadhaarForm;
  const aadhaarIdentity = digilockerAadhaarIdentityBag(form);
  const hasAadhaarDetails = Boolean(
    aadhaarIdentity.name ||
      aadhaarIdentity.dob ||
      aadhaarIdentity.gender ||
      aadhaarIdentity.fullAddress,
  );

  return (
    <KycJourneyShell
      mobileStepLabel="Selfie"
      mobileOnBack={() => router.push('/kyc')}
      journeyPanel={
        <>
          <div className={`${styles.reveal} ${styles.d1}`}>
            <span className={styles.eyebrow}>KYC</span>
          </div>
          <h1 className={`${styles.rightTitle} ${styles.reveal} ${styles.d1}`}>Selfie &amp; liveness</h1>

          <div className={`${styles.selfiePanel} ${styles.reveal} ${styles.d3} grid gap-4`}>
            {error && !(selfieQuality && !selfieQuality.ok) ? (
              <AlertBanner variant="error">{error}</AlertBanner>
            ) : null}

            {selfieQuality && !selfieQuality.ok && !busy ? (
              <SelfieQualityGuidance quality={selfieQuality} />
            ) : null}

            {photoHref || hasAadhaarDetails ? (
              <div className="hidden gap-3 rounded-2xl border border-[rgba(18,36,79,0.12)] bg-white/90 p-3 lg:grid lg:grid-cols-2 lg:items-start">
                <div className="min-w-0">
                  <p className="m-0 mb-2 text-sm font-semibold text-brand-navy">Aadhaar details</p>
                  {hasAadhaarDetails ? (
                    <dl className="m-0 grid gap-2 text-sm">
                      <div className="grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-0.5">
                        <dt className="text-brand-muted font-medium">Name</dt>
                        <dd className="m-0 text-brand-navy break-words">{aadhaarIdentity.name ?? '—'}</dd>
                        <dt className="text-brand-muted font-medium">DOB</dt>
                        <dd className="m-0 text-brand-navy">{aadhaarIdentity.dob ?? '—'}</dd>
                        <dt className="text-brand-muted font-medium">Gender</dt>
                        <dd className="m-0 text-brand-navy">{aadhaarIdentity.gender ?? '—'}</dd>
                        <dt className="text-brand-muted font-medium">Full Address</dt>
                        <dd className="m-0 text-brand-navy break-words">{aadhaarIdentity.fullAddress ?? '—'}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="m-0 text-sm text-brand-muted">Aadhaar details are not available yet.</p>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="m-0 mb-2 text-sm font-semibold text-brand-navy">Aadhaar photo</p>
                  {photoHref ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoHref}
                      alt="Aadhaar reference"
                      className="w-full max-h-56 object-contain rounded-xl bg-slate-50"
                    />
                  ) : (
                    <p className="m-0 text-sm text-brand-muted">Photo not available.</p>
                  )}
                </div>
              </div>
            ) : null}

            {phase === 'head-movement' ? (
              <div className="rounded-2xl border border-[rgba(18,36,79,0.12)] bg-white/90 p-4">
                <p className="m-0 text-sm font-semibold text-brand-navy">Head movement check</p>
                <p className="m-0 mt-1 text-sm text-brand-muted">
                  Your selfie matches your Aadhaar photo. Last step — record a short clip: slowly turn
                  your head left and right or nod up and down, while looking at the camera.
                </p>
              </div>
            ) : null}

            {needsWebcamStream ? (
              <div className="overflow-hidden rounded-2xl border border-[rgba(18,36,79,0.12)] bg-black aspect-[4/3] max-h-[360px]">
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
              </div>
            ) : null}
            <canvas ref={canvasRef} className="hidden" />

            {phase !== 'head-movement' && needsWebcamStream ? (
              <button
                type="button"
                disabled={busy || !cameraReady}
                onClick={() => void handleCapture()}
                className="mc-btn-primary w-full"
              >
                {busy ? busyLabel || 'Please wait…' : retakeSelfie ? 'Try again' : 'Capture from webcam'}
              </button>
            ) : null}

            {phase === 'head-movement' ? (
              <div className="grid gap-3">
                {busy && recordingPct > 0 ? (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(18,36,79,0.08)]">
                    <div
                      className="h-full rounded-full bg-[#1496f3] transition-[width] duration-200"
                      style={{ width: `${recordingPct}%` }}
                    />
                  </div>
                ) : null}

                {headMovementScore != null ? (
                  <p className="m-0 text-sm text-brand-muted">
                    Movement score:{' '}
                    <span className="font-semibold text-brand-navy">
                      {Math.round(headMovementScore * 100)}%
                    </span>
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={busy || !cameraReady}
                  onClick={() => void handleHeadMovement()}
                  className="mc-btn-primary w-full"
                >
                  {busy
                    ? busyLabel || 'Please wait…'
                    : headMovementScore != null
                      ? 'Record again'
                      : 'Start head movement check'}
                </button>
              </div>
            ) : null}

            {busy && busyLabel && !needsWebcamStream ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/80 p-4">
                <Spinner size={28} />
                <p className="m-0 text-sm font-semibold text-brand-navy">{busyLabel}</p>
              </div>
            ) : null}

            {selfieAlreadySaved && !retakeSelfie && !busy && !livenessRetryNeeded && phase !== 'head-movement' ? (
              <button
                type="button"
                className="mc-btn-secondary w-full bg-[rgba(20,150,243,0.08)] text-brand-navy"
                onClick={handleRetakeSelfie}
              >
                Replace selfie
              </button>
            ) : null}

            {livenessRetryNeeded && !retakeSelfie && !busy && phase !== 'head-movement' ? (
              <div className="grid gap-3 rounded-2xl border border-[rgba(18,36,79,0.12)] bg-white/90 p-4">
                <p className="m-0 text-sm text-brand-muted">
                  Selfie saved. Face liveness did not pass or was not completed — retry with the same photo, or take a
                  new selfie and try again.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLiveness()}
                    className="mc-btn-primary"
                  >
                    {busy ? busyLabel || 'Please wait…' : 'Retry liveness check'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRetakeSelfie}
                    className="mc-btn-secondary bg-[rgba(20,150,243,0.08)] text-brand-navy"
                  >
                    Take selfie again
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      }
    />
  );
}

/** Failed photo gates only — tell the customer what to change, not a full pass/fail list. */
function selfieQualityIssues(quality: KycPhotoQualitySummary): Array<{ title: string; hint: string }> {
  const issues: Array<{ title: string; hint: string }> = [];

  if (quality.dualFaceDetected) {
    issues.push({
      title: 'More than one person in the photo',
      hint:
        quality.faceCount > 1
          ? `We found ${quality.faceCount} faces. Take the photo with only you in the frame.`
          : 'Make sure nobody else is visible behind or beside you.',
    });
  }
  if (!quality.fullFaceDetected) {
    issues.push({
      title: 'Face is not fully visible',
      hint: 'Move closer and look straight at the camera so your whole face fills the frame.',
    });
  }
  if (!quality.faceNotCovered) {
    issues.push({
      title: 'Face is covered',
      hint: 'Remove masks, sunglasses, hats, or anything covering your eyes, nose, or mouth.',
    });
  }
  if (quality.blurPassed === false) {
    issues.push({
      title: 'Photo is too blurry',
      hint: 'Hold your phone steady, wait for the camera to focus, and try again.',
    });
  }
  if (quality.lightingPassed === false) {
    issues.push({
      title: 'Lighting is too dark',
      hint: 'Move to a brighter place and face a window or lamp so your face is clearly lit.',
    });
  }

  if (issues.length === 0) {
    issues.push({
      title: 'We could not use this selfie',
      hint:
        quality.reason?.trim() ||
        'Look at the camera, use good lighting, and keep your full face visible.',
    });
  }

  return issues;
}

function SelfieQualityGuidance({ quality }: { quality: KycPhotoQualitySummary }) {
  const issues = selfieQualityIssues(quality);
  return (
    <div className="grid gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-orange-50/40 p-4">
      <p className="m-0 text-sm font-extrabold text-brand-navy">Fix these and try again</p>
      <ul className="m-0 grid list-none gap-3 p-0">
        {issues.map((issue) => (
          <li key={issue.title} className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[0.85rem] font-extrabold text-amber-800"
              aria-hidden
            >
              !
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-brand-navy">{issue.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{issue.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function KycSelfiePage() {
  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <KycSelfieContent />
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
