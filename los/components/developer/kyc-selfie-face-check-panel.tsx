'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildLocalSelfieFaceExtraRows,
  buildLivenessExtraRows,
  KycTenacioVendorResult,
} from '@/components/developer/kyc-tenacio-vendor-result';
import { runKycSelfieFaceCheck, type LosSelfieFaceCheckResult } from '@/lib/api/kyc-selfie-face-check';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64 ?? '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return new File([u8], name, { type: mime });
}

function formatScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function bestDetectionScore(detections: LosSelfieFaceCheckResult['local']['detections']): number | null {
  if (!detections.length) return null;
  return Math.max(...detections.map((d) => d.score));
}

export function KycSelfieFaceCheckPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<LosSelfieFaceCheckResult | null>(null);

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
      const out = await runKycSelfieFaceCheck(token, file);
      setResult(out);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Selfie face check failed.');
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
    const file = dataUrlToFile(dataUrl, 'selfie.jpg');
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

  const local = result?.local;

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Dry-run customer selfie KYC: <strong>local ML</strong> first (<code className="text-[0.8rem]">face-api</code>{' '}
        detection, blur, landmarks), then <strong>Tenacio liveness</strong> when local validation passes and{' '}
        <code className="text-[0.8rem]">TENACIO_LIVENESS_WORKFLOW_ID</code> is configured. Uploaded JPEGs are stored
        temporarily so Tenacio can fetch a public URL.
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
          <img src={previewUrl} alt="Selfie preview" className="max-h-64 w-full rounded-[12px] object-contain" />
        </div>
      ) : null}

      {result && local ? (
        <div className="grid gap-4">
          <KycTenacioVendorResult
            result={{
              configured: true,
              ok: local.ok,
              httpStatus: null,
              vendor: local,
              businessOk: local.ok,
              summary: {},
            }}
            sectionTitle="Local ML (selfie validation)"
            rawJsonLabel="Local inspection JSON"
            showHttpRows={false}
            passLabel="Local selfie validation would pass"
            failLabel="Local selfie validation would fail"
            extraRows={buildLocalSelfieFaceExtraRows(local)}
          />
          {local.reason && !local.ok ? (
            <p className="m-0 text-[0.84rem] leading-[1.5] text-brand-text">{local.reason}</p>
          ) : null}

          {local.ok && result.tenacio && !result.tenacio.configured ? (
            <p className="m-0 rounded-[12px] border border-[rgba(245,158,11,0.35)] bg-[rgba(255,251,235,0.9)] px-4 py-3 text-[0.84rem] leading-[1.5] text-[#92400e]">
              Local ML passed but Tenacio liveness was not called. Set{' '}
              <code className="text-[0.8rem]">TENACIO_LIVENESS_WORKFLOW_ID</code> (and public storage URL) to test the
              full customer flow.
            </p>
          ) : null}

          {result.tenacio ? (
            <KycTenacioVendorResult
              result={result.tenacio}
              sectionTitle="Tenacio liveness"
              skipLabel="Tenacio liveness not enabled"
              passLabel="Tenacio liveness would pass"
              failLabel="Tenacio liveness would fail"
              extraRows={buildLivenessExtraRows(result.tenacio)}
            />
          ) : null}

          {local.confidenceBreakdown ? (
            <details className="rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white px-4 py-3">
              <summary className="cursor-pointer text-[0.82rem] font-bold text-brand-navy">
                Confidence breakdown (algorithm)
              </summary>
              <dl className="m-0 mt-2 grid gap-1.5 text-[0.78rem] text-brand-muted">
                <div className="grid grid-cols-[minmax(0,0.5fr)_1fr] gap-2">
                  <dt>Detection (35%)</dt>
                  <dd className="m-0 font-mono">{formatScore(local.confidenceBreakdown.detection)}</dd>
                </div>
                <div className="grid grid-cols-[minmax(0,0.5fr)_1fr] gap-2">
                  <dt>Face size (15%)</dt>
                  <dd className="m-0 font-mono">{formatScore(local.confidenceBreakdown.faceSize)}</dd>
                </div>
                <div className="grid grid-cols-[minmax(0,0.5fr)_1fr] gap-2">
                  <dt>Landmark alignment (25%)</dt>
                  <dd className="m-0 font-mono">{formatScore(local.confidenceBreakdown.landmarkAlignment)}</dd>
                </div>
                <div className="grid grid-cols-[minmax(0,0.5fr)_1fr] gap-2">
                  <dt>Feature spacing (25%)</dt>
                  <dd className="m-0 font-mono">{formatScore(local.confidenceBreakdown.featureSpacing)}</dd>
                </div>
              </dl>
            </details>
          ) : null}

          {bestDetectionScore(local.detections) != null ? (
            <p className="m-0 text-[0.82rem] text-brand-muted">
              Raw detection score:{' '}
              <span className="font-mono font-semibold text-brand-navy">
                {formatScore(bestDetectionScore(local.detections)!)}
              </span>
            </p>
          ) : null}

          {local.productionValidationDisabled ? (
            <p className="m-0 text-[0.84rem] text-[#92400e]">
              KYC_SELFIE_FACE_VALIDATION_DISABLED is on — customer upload would skip local validation.
            </p>
          ) : null}

          <div
            className={cx(
              'rounded-[14px] border px-4 py-3 text-[0.86rem] font-bold',
              result.businessOk
                ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)] text-[#166534]'
                : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)] text-[#991b1b]',
            )}
          >
            Overall: {result.businessOk ? 'Would pass (local + Tenacio when enabled)' : 'Would fail'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
