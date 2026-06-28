'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildDeepfakeExtraRows,
  buildLocalSelfieFaceExtraRows,
  KycTenacioVendorResult,
} from '@/components/developer/kyc-tenacio-vendor-result';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';
import { runKycDeepfakeCheck, type LosDeepfakeCheckResult } from '@/lib/api/kyc-tenacio-checks';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64 ?? '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return new File([u8], name, { type: mime });
}

export function KycDeepfakeCheckPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<LosDeepfakeCheckResult | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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

  async function runCheck(file: File, preview: string) {
    setRequestError(null);
    setResult(null);
    setPreviewUrl(preview);

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      const out = await runKycDeepfakeCheck(token, file);
      setResult(out);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Selfie authenticity check failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCapture() {
    setCameraError(null);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) {
      setCameraError('Camera is not ready yet.');
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setCameraError('Video has no dimensions yet — wait a moment and try again.');
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Could not read from camera.');
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const file = dataUrlToFile(dataUrl, 'image.jpg');
    await runCheck(file, dataUrl);
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setCameraError(null);
    if (!file.type.toLowerCase().includes('jpeg') && !file.type.toLowerCase().includes('jpg')) {
      setRequestError('Please choose a JPEG image.');
      return;
    }
    const preview = URL.createObjectURL(file);
    await runCheck(file, preview);
  }

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Dry-run selfie authenticity. <strong>Local ML</strong> (<code className="text-[0.8rem]">face-api</code>) only
        checks face detection, blur, and landmarks — it <strong>cannot detect AI-generated or synthetic photos</strong>.
        Use <strong>Tenacio deepfake</strong> (when <code className="text-[0.8rem]">TENACIO_DEEPFAKE_WORKFLOW_ID</code>{' '}
        is set) to catch fake images before customer liveness.
      </p>

      {cameraError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{cameraError}</p> : null}
      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      <div className="grid gap-4 rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white p-5">
        <div className="overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.12)] bg-black aspect-[4/3] max-h-[360px]">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || !cameraReady}
            onClick={() => void handleCapture()}
            className="cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
          >
            {loading ? 'Checking…' : 'Capture & check'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-[12px] border border-[rgba(23,44,113,0.16)] bg-[rgba(248,250,255,0.9)] px-5 py-2.5 text-[0.88rem] font-extrabold text-brand-navy disabled:opacity-60"
          >
            Upload JPEG
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,.jpg"
            className="hidden"
            onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {previewUrl ? (
        <div className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white p-5">
          <p className="m-0 mb-2 text-[0.8rem] font-bold text-brand-navy">Checked image</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Check preview" className="max-h-64 w-full rounded-[12px] object-contain" />
        </div>
      ) : null}

      {result ? (
        <div className="grid gap-4">
          <KycTenacioVendorResult
            result={{
              configured: true,
              ok: result.local.ok,
              httpStatus: null,
              vendor: result.local,
              businessOk: result.local.ok,
              summary: {},
            }}
            sectionTitle="Local ML (selfie validation)"
            rawJsonLabel="Local inspection JSON"
            showHttpRows={false}
            passLabel="Local selfie validation would pass"
            failLabel="Local selfie validation would fail"
            extraRows={buildLocalSelfieFaceExtraRows(result.local)}
          />
          {result.local.reason && !result.local.ok ? (
            <p className="m-0 text-[0.84rem] leading-[1.5] text-brand-text">{result.local.reason}</p>
          ) : null}
          {result.local.ok && result.tenacio && !result.tenacio.configured ? (
            <p className="m-0 rounded-[12px] border border-[rgba(245,158,11,0.35)] bg-[rgba(255,251,235,0.9)] px-4 py-3 text-[0.84rem] leading-[1.5] text-[#92400e]">
              Local ML passed, but this image could still be AI-generated. Enable{' '}
              <code className="text-[0.8rem]">TENACIO_DEEPFAKE_WORKFLOW_ID</code> to run synthetic-media detection.
            </p>
          ) : null}
          {result.tenacio ? (
            <KycTenacioVendorResult
              result={result.tenacio}
              sectionTitle="Tenacio deepfake (optional)"
              skipLabel="Tenacio deepfake not enabled"
              passLabel="Tenacio: no deepfake flag"
              failLabel="Tenacio: deepfake / synthetic media suspected"
              extraRows={buildDeepfakeExtraRows(result.tenacio)}
            />
          ) : null}
          <div
            className={cx(
              'rounded-[14px] border px-4 py-3 text-[0.86rem] font-bold',
              result.businessOk
                ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)] text-[#166534]'
                : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)] text-[#991b1b]',
            )}
          >
            Overall: {result.businessOk ? 'Would pass (local; Tenacio when enabled)' : 'Would fail'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
