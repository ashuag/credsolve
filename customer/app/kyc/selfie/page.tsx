'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { JourneyProgressProvider } from '@/components/journey/journey-progress-context';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import { getApiUrl } from '@/lib/api-url';
import { getCustomerJourneyResumePath } from '@/lib/api/customer-session';
import { pickLivenessFailureUserMessage, postKycLiveness, postKycSelfie } from '@/lib/api/kyc-face';

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

export default function KycSelfiePage() {
  const router = useRouter();
  const { loading, session, refresh } = useCustomerSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  /** Open webcam only while capturing; not after a saved selfie (avoids permission prompts on refresh / return visits). */
  const [retakeSelfie, setRetakeSelfie] = useState(false);

  const kyc = session?.authenticated === true ? session.kycFaceProgress : null;
  const photoHref =
    kyc?.digilockerAadhaarPhotoUrl && session?.authenticated === true
      ? `${getApiUrl()}${kyc.digilockerAadhaarPhotoUrl}`
      : null;
  const selfieHref =
    kyc?.kycSelfiePhotoUrl && session?.authenticated === true ? `${getApiUrl()}${kyc.kycSelfiePhotoUrl}` : null;

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

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) setError('Could not access the camera. Allow camera permission and try again.');
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [needsWebcamStream, stopCamera]);

  async function afterStep() {
    const next = await refresh();
    if (next.authenticated && next.journey.kycCompleted) {
      router.replace(getCustomerJourneyResumePath(next));
    }
  }

  async function handleContinueAfterSelfie() {
    setError('');
    setBusy(true);
    try {
      const next = await refresh();
      if (!next.authenticated) return;
      if (!next.kycFaceProgress?.selfieCaptured) {
        setError('Capture and save a selfie before continuing.');
        return;
      }
      router.replace(getCustomerJourneyResumePath(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not continue.');
    } finally {
      setBusy(false);
    }
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
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const file = dataUrlToFile(dataUrl, 'selfie.jpg');
      const out = await postKycSelfie(file);
      if (!out?.success) {
        setError('Selfie upload did not complete.');
        return;
      }
      setRetakeSelfie(false);
      stopCamera();
      await afterStep();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Selfie upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLiveness() {
    setError('');
    setBusy(true);
    try {
      const out = await postKycLiveness();
      if (!out) {
        setError('Empty response from liveness.');
        return;
      }
      if (!out.configured) {
        setError(out.skipReason ?? 'Liveness is not configured on the server.');
        return;
      }
      if (!out.livenessPassed) {
        setError(pickLivenessFailureUserMessage(out));
        await refresh();
        return;
      }
      await afterStep();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liveness request failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return (
      <CustomerJourneyGuard>
        <div className="flex min-h-[40vh] items-center justify-center p-6">
          <Spinner size={36} />
        </div>
      </CustomerJourneyGuard>
    );
  }

  if (session.authenticated !== true) {
    return (
      <CustomerJourneyGuard>
        <div className="flex min-h-[40vh] items-center justify-center p-6">
          <Spinner size={36} />
        </div>
      </CustomerJourneyGuard>
    );
  }

  const form = kyc?.digilockerAadhaarForm;
  const entries = shallowStringEntries(form);

  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <div className="mx-auto max-w-lg p-6 grid gap-4">
          <header>
            <p className="m-0 text-[0.7rem] font-[800] uppercase tracking-[0.14em] text-[#1496f3]">KYC</p>
            <h1 className="mt-2 text-brand-navy text-2xl font-[900] tracking-tight">Selfie &amp; liveness</h1>
            <p className="m-0 text-brand-muted text-[0.95rem] leading-relaxed">
              We compare your selfie with your DigiLocker Aadhaar photo. Use a well-lit area; remove hats or
              sunglasses.
            </p>
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

          {selfieHref ? (
            <div className="rounded-2xl border border-[rgba(18,36,79,0.12)] p-3 bg-white/90">
              <p className="m-0 mb-2 text-sm font-semibold text-brand-navy">Your saved selfie</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selfieHref} alt="Your selfie" className="w-full max-h-56 object-contain rounded-xl" />
            </div>
          ) : null}

          {needsWebcamStream ? (
            <div className="rounded-2xl overflow-hidden border border-[rgba(18,36,79,0.12)] bg-black aspect-[4/3] max-h-[360px]">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            </div>
          ) : null}
          <canvas ref={canvasRef} className="hidden" />

          {needsWebcamStream ? (
            <button type="button" disabled={busy || !cameraReady} onClick={() => void handleCapture()} className="mc-btn-primary">
              Capture from webcam
            </button>
          ) : null}

          {selfieAlreadySaved && !retakeSelfie ? (
            <button
              type="button"
              className="text-sm font-semibold text-[#1496f3] underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer text-left"
              onClick={() => {
                setError('');
                setRetakeSelfie(true);
              }}
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

          {kyc?.selfieCaptured ? (
            <div className="grid gap-2">
              {kyc.livenessRequired === false ? (
                <>
                  <p className="m-0 text-sm text-brand-muted">
                    Liveness checks are paused. A saved selfie is still required — yours is on file below. Continue when
                    you are ready.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleContinueAfterSelfie()}
                    className="mc-btn-primary"
                  >
                    Continue
                  </button>
                </>
              ) : (
                <>
                  <p className="m-0 text-sm text-brand-muted">Selfie saved. Run liveness check to continue.</p>
                  <button type="button" disabled={busy} onClick={() => void handleLiveness()} className="mc-btn-primary">
                    Run liveness check
                  </button>
                </>
              )}
            </div>
          ) : null}

          {kyc?.livenessPassed ? (
            <p className="m-0 text-sm font-semibold text-emerald-700">Liveness passed. You can continue your application.</p>
          ) : null}
        </div>
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
