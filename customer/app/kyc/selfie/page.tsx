'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { KycJourneyLeftPanel } from '@/components/kyc/kyc-journey-left-panel';
import styles from '@/components/kyc/kyc-hub-flow.module.css';
import { JourneyProgressProvider, useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import { getApiUrl } from '@/lib/api-url';
import { getCustomerJourneyResumePath, type CustomerSessionResponse } from '@/lib/api/customer-session';
import { kycJourneyProgressFromSession } from '@/lib/kyc-journey-progress';
import { postKycLiveness, postKycSelfie } from '@/lib/api/kyc-face';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64 ?? '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return new File([u8], name, { type: mime });
}

function shallowStringEntries(obj: unknown): Array<[string, string]> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === 'photo' || k === 'xml' || k === 'raw') continue;
    if (typeof v === 'string' && v.length > 0 && v.length < 500) out.push([k, v]);
  }
  return out.slice(0, 12);
}

function KycSelfieShell({
  session,
  children,
}: {
  session: Extract<CustomerSessionResponse, { authenticated: true }>;
  children: React.ReactNode;
}) {
  const journey = useJourneyProgressOptional();
  const { progressPct, activeStepIndex } = useMemo(
    () => kycJourneyProgressFromSession(session),
    [session],
  );

  useEffect(() => {
    journey?.setCompletion01(progressPct / 100);
  }, [journey, progressPct]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <KycJourneyLeftPanel
          loanSelection={session.loanSelection}
          progressPct={progressPct}
          activeStepIndex={activeStepIndex}
        />
        <section className={styles.right}>{children}</section>
      </div>
    </div>
  );
}

export default function KycSelfiePage() {
  const router = useRouter();
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

  const navigatingRef = useRef(false);

  const kyc = session?.authenticated === true ? session.kycFaceProgress : null;
  const photoHref =
    kyc?.digilockerAadhaarPhotoUrl && session?.authenticated === true
      ? `${getApiUrl()}${kyc.digilockerAadhaarPhotoUrl}`
      : null;
  const selfieHref =
    kyc?.kycSelfiePhotoUrl && session?.authenticated === true
      ? `${getApiUrl()}${kyc.kycSelfiePhotoUrl}${
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

  async function continueToNextStep(prefetched?: CustomerSessionResponse) {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    const next = prefetched ?? (await refresh());
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
    if (progress.livenessCheckCompleted && !progress.livenessPassed) {
      router.replace('/thank-you');
      return;
    }
    if (progress.livenessRequired === false || progress.livenessPassed) {
      void continueToNextStep();
    }
  }, [loading, busy, session, retakeSelfie, router]);

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
    // MoneyCash liveness → Tenacio liveness → MoneyCash face match: all must pass.
    if (
      out.internalError ||
      !out.livenessPassed ||
      out.faceValidationPassed === false ||
      out.faceMatchPassed === false
    ) {
      await refresh();
      router.replace('/thank-you');
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
      setRetakeSelfie(false);
      stopCamera();

      const livenessRequired =
        session?.authenticated === true && session.kycFaceProgress?.livenessRequired !== false;
      setBusyLabel(
        livenessRequired
          ? 'Running MoneyCash liveness, Tenacio liveness, then face match…'
          : 'Running MoneyCash liveness and face match…',
      );
      const passed = await runLivenessCheck();
      const nextSession = await refresh();
      setPendingSelfiePreview(null);
      if (!nextSession.authenticated) return;
      if (!passed) return;

      await continueToNextStep(nextSession);
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
    setBusyLabel('Running MoneyCash liveness, Tenacio liveness, then face match…');
    try {
      const passed = await runLivenessCheck();
      const nextSession = await refresh();
      if (!nextSession.authenticated) return;
      if (!passed) return;
      await continueToNextStep(nextSession);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liveness request failed.');
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  }

  if (loading || !session) {
    return (
      <CustomerJourneyGuard>
        <JourneyProgressProvider>
          <div className={styles.page}>
            <div className="flex flex-1 items-center justify-center p-6">
              <Spinner size={36} />
            </div>
          </div>
        </JourneyProgressProvider>
      </CustomerJourneyGuard>
    );
  }

  if (session.authenticated !== true) {
    return (
      <CustomerJourneyGuard>
        <JourneyProgressProvider>
          <div className={styles.page}>
            <div className="flex flex-1 items-center justify-center p-6">
              <Spinner size={36} />
            </div>
          </div>
        </JourneyProgressProvider>
      </CustomerJourneyGuard>
    );
  }

  /** Only when selfie was saved but the face pipeline never finished (e.g. network drop). */
  const livenessRetryNeeded =
    kyc?.selfieCaptured === true &&
    kyc.livenessCheckCompleted !== true &&
    kyc.livenessRequired !== false &&
    kyc.livenessPassed !== true;

  function handleRetakeSelfie() {
    setError('');
    setPendingSelfiePreview(null);
    setRetakeSelfie(true);
  }

  const form = kyc?.digilockerAadhaarForm;
  const entries = shallowStringEntries(form);

  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <KycSelfieShell session={session}>
          <div className="grid max-w-xl gap-4">
            <header>
              <p className={`m-0 ${styles.eyebrow}`}>KYC</p>
              <h1 className={styles.rightTitle}>Selfie &amp; liveness</h1>
            </header>

          {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

          {photoHref ? (
            <div className="rounded-2xl border border-[rgba(18,36,79,0.12)] p-3 bg-white/90">
              <p className="m-0 mb-2 text-sm font-semibold text-brand-navy">Aadhaar reference photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoHref} alt="Aadhaar reference" className="w-full max-h-56 object-contain rounded-xl" />
            </div>
          ) : null}

          {entries.length > 0 ? (
            <dl className="grid gap-1 rounded-2xl border border-[rgba(18,36,79,0.08)] p-3 bg-slate-50/80 text-sm">
              {entries.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,0.35fr)_1fr] gap-2">
                  <dt className="text-brand-muted font-medium truncate">{k}</dt>
                  <dd className="m-0 text-brand-navy break-words">{v}</dd>
                </div>
              ))}
            </dl>
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
            <button type="button" disabled={busy || !cameraReady} onClick={() => void handleCapture()} className="mc-btn-primary">
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
                Selfie saved, but face checks did not finish. Retry the checks, or take a new selfie.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleLiveness()}
                  className="mc-btn-primary"
                >
                  {busy ? busyLabel || 'Please wait…' : 'Retry face checks'}
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
        </KycSelfieShell>
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
