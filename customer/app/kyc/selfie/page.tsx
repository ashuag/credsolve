'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import {
  JourneyProgressProvider,
  useJourneyProgressOptional,
} from '@/components/journey/journey-progress-context';
import { KycJourneyLeftPanel } from '@/components/kyc/kyc-journey-left-panel';
import styles from '@/components/kyc/kyc-hub-flow.module.css';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import { getCustomerJourneyResumePath } from '@/lib/api/customer-session';
import { pickLivenessFailureUserMessage, postKycLiveness, postKycSelfie } from '@/lib/api/kyc-face';
import { kycJourneyProgressFromSession } from '@/lib/kyc-journey-progress';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';

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
    fullAddress,
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
  /** Shown immediately after capture so the UI does not flash the previous cached selfie. */
  const [pendingSelfiePreview, setPendingSelfiePreview] = useState<string | null>(null);
  const [suggestRetake, setSuggestRetake] = useState(false);

  const navigatingRef = useRef(false);

  const loanSelection = session?.authenticated === true ? session.loanSelection : null;
  const { progressPct, activeStepIndex } = useMemo(
    () => kycJourneyProgressFromSession(session),
    [session],
  );

  useEffect(() => {
    journey?.setCompletion01(progressPct / 100);
  }, [journey, progressPct]);

  const kyc = session?.authenticated === true ? session.kycFaceProgress : null;
  const photoHref =
    kyc?.digilockerAadhaarPhotoUrl && session?.authenticated === true
      ? `/api${kyc.digilockerAadhaarPhotoUrl}`
      : null;
  const selfieHref =
    kyc?.kycSelfiePhotoUrl && session?.authenticated === true
      ? `/api${kyc.kycSelfiePhotoUrl}${
          kyc.selfieUpdatedAt ? `?v=${encodeURIComponent(kyc.selfieUpdatedAt)}` : ''
        }`
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
  const needsWebcamStream =
    !loading &&
    session?.authenticated === true &&
    kyc != null &&
    (!selfieAlreadySaved || retakeSelfie);

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

  useEffect(() => {
    if (loading || busy || session?.authenticated !== true || retakeSelfie) return;
    const progress = session.kycFaceProgress;
    if (!progress?.selfieCaptured) return;
    if (progress.livenessRequired === false || progress.livenessPassed) {
      void continueToNextStep();
    }
  }, [loading, busy, session, retakeSelfie]);

  async function runLivenessCheck(): Promise<boolean> {
    const out = await postKycLiveness();
    if (!out) {
      setError('Empty response from liveness.');
      return false;
    }
    if (!out.configured) {
      setError(out.skipReason ?? 'Liveness is not configured on the server.');
      return false;
    }
    if (
      out.suggestRetrySelfie ||
      out.faceValidationPassed === false ||
      out.faceMatchPassed === false ||
      out.authenticityPassed === false
    ) {
      setSuggestRetake(true);
      setRetakeSelfie(true);
      setPendingSelfiePreview(null);
      stopCamera();
    }
    if (!out.livenessPassed) {
      setError(pickLivenessFailureUserMessage(out));
      await refresh();
      return false;
    }
    return true;
  }

  async function handleCapture() {
    setError('');
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
    setBusyLabel('Saving selfie…');
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setPendingSelfiePreview(dataUrl);
      const file = dataUrlToFile(dataUrl, 'selfie.jpg');
      const out = await postKycSelfie(file);
      if (!out?.success) {
        setError('Selfie upload did not complete.');
        return;
      }
      setSuggestRetake(false);
      setRetakeSelfie(false);
      stopCamera();

      const refreshed = await refresh();
      setPendingSelfiePreview(null);
      if (!refreshed.authenticated) return;

      const livenessLabel =
        refreshed.kycFaceProgress?.livenessRequired !== false
          ? 'Running local face checks, then Tenacio liveness…'
          : 'Running local face checks…';
      setBusyLabel(livenessLabel);
      const passed = await runLivenessCheck();
      if (!passed) return;

      await continueToNextStep();
    } catch (e) {
      setPendingSelfiePreview(null);
      const msg = e instanceof Error ? e.message : 'Selfie upload failed.';
      setError(msg);
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  }

  async function handleLiveness() {
    setError('');
    setBusy(true);
    setBusyLabel('Running local face checks, then Tenacio liveness…');
    try {
      const passed = await runLivenessCheck();
      if (!passed) return;
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
      <div className={styles.page}>
        <div className={styles.shell}>
          <KycJourneyLeftPanel
            loanSelection={null}
            progressPct={progressPct}
            activeStepIndex={activeStepIndex}
          />
          <section className={`${styles.right} ${styles.rightCentered}`}>
            <Spinner size={36} />
          </section>
        </div>
      </div>
    );
  }

  const livenessRetryNeeded =
    kyc?.selfieCaptured === true &&
    kyc.livenessRequired !== false &&
    kyc.livenessPassed !== true;

  function handleRetakeSelfie() {
    setError('');
    setPendingSelfiePreview(null);
    setSuggestRetake(false);
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
    <div className={styles.page}>
      <div className={styles.shell}>
        <KycJourneyLeftPanel
          loanSelection={loanSelection}
          progressPct={progressPct}
          activeStepIndex={activeStepIndex}
        />

        <section className={styles.right}>
          <div className={`${styles.reveal} ${styles.d1}`}>
            <span className={styles.eyebrow}>KYC</span>
          </div>
          <h1 className={`${styles.rightTitle} ${styles.reveal} ${styles.d1}`}>Selfie &amp; liveness</h1>

          <div className={`${styles.selfiePanel} ${styles.reveal} ${styles.d3} grid gap-4`}>
            {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
            {suggestRetake && !busy ? (
              <AlertBanner variant="error">
                Your selfie did not pass our on-server checks (face validation or Aadhaar match). Take a new photo with
                your full face visible, then we will run liveness again.
              </AlertBanner>
            ) : null}

            {photoHref || hasAadhaarDetails ? (
              <div className="grid gap-3 sm:grid-cols-2 sm:items-start rounded-2xl border border-[rgba(18,36,79,0.12)] p-3 bg-white/90">
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

            {(pendingSelfiePreview ?? selfieHref) && !retakeSelfie ? (
              <div className="rounded-2xl border border-[rgba(18,36,79,0.12)] p-3 bg-white/90">
                <p className="m-0 mb-2 text-sm font-semibold text-brand-navy">Your saved selfie</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingSelfiePreview ?? selfieHref!}
                  alt="Your selfie"
                  className="w-full max-h-56 object-contain rounded-xl"
                />
              </div>
            ) : null}

            {needsWebcamStream ? (
              <div className="rounded-2xl overflow-hidden border border-[rgba(18,36,79,0.12)] bg-black aspect-[4/3] max-h-[360px]">
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
              </div>
            ) : null}
            <canvas ref={canvasRef} className="hidden" />

            {needsWebcamStream ? (
              <button
                type="button"
                disabled={busy || !cameraReady}
                onClick={() => void handleCapture()}
                className="mc-btn-primary"
              >
                {busy ? busyLabel || 'Please wait…' : 'Capture from webcam'}
              </button>
            ) : null}

            {busy && busyLabel && !needsWebcamStream ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/80 p-4">
                <Spinner size={28} />
                <p className="m-0 text-sm font-semibold text-brand-navy">{busyLabel}</p>
              </div>
            ) : null}

            {selfieAlreadySaved && !retakeSelfie && !livenessRetryNeeded ? (
              <button
                type="button"
                className="text-sm font-semibold text-[#1496f3] underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer text-left"
                onClick={handleRetakeSelfie}
              >
                Replace selfie (opens camera)
              </button>
            ) : retakeSelfie ? (
              <button
                type="button"
                className="text-sm font-medium text-brand-muted underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer text-left"
                onClick={() => {
                  setRetakeSelfie(false);
                  setError('');
                }}
              >
                Cancel replace
              </button>
            ) : null}

            {livenessRetryNeeded && !retakeSelfie ? (
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
        </section>
      </div>
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
