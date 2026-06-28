'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildFaceMatchExtraRows,
  buildLocalFaceMatchExtraRows,
  KycTenacioVendorResult,
} from '@/components/developer/kyc-tenacio-vendor-result';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';
import { runKycFaceMatchCheck, type LosFaceMatchCheckResult } from '@/lib/api/kyc-tenacio-checks';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';

type InputMode = 'upload' | 'selfie' | 'url';
type SideKey = 'reference' | 'probe';

type SideReady =
  | { kind: 'file'; file: File; preview: string }
  | { kind: 'url'; url: string };

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64 ?? '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return new File([u8], name, { type: mime });
}

function ModeTabs({
  mode,
  disabled,
  onChange,
}: {
  mode: InputMode;
  disabled: boolean;
  onChange: (mode: InputMode) => void;
}) {
  const tabs: Array<{ id: InputMode; label: string }> = [
    { id: 'upload', label: 'Upload image' },
    { id: 'selfie', label: 'Selfie' },
    { id: 'url', label: 'URL' },
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] border border-[rgba(23,44,113,0.1)] bg-[rgba(248,250,255,0.8)] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(tab.id)}
          className={cx(
            'cursor-pointer rounded-[8px] px-3 py-1.5 text-[0.74rem] font-bold transition-colors disabled:opacity-60',
            mode === tab.id
              ? 'bg-brand-blue text-white shadow-sm'
              : 'bg-transparent text-brand-navy hover:bg-white/80',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function FaceMatchSideInput({
  label,
  hint,
  mode,
  onModeChange,
  previewUrl,
  urlValue,
  onUrlChange,
  onFile,
  onClear,
  disabled,
  selfieActive,
  onActivateSelfie,
  cameraReady,
  onCaptureSelfie,
  cameraError,
}: {
  label: string;
  hint: string;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  previewUrl: string | null;
  urlValue: string;
  onUrlChange: (url: string) => void;
  onFile: (file: File, preview: string) => void;
  onClear: () => void;
  disabled: boolean;
  selfieActive: boolean;
  onActivateSelfie: () => void;
  cameraReady: boolean;
  onCaptureSelfie: () => void;
  cameraError: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'selfie') onActivateSelfie();
  }, [mode, onActivateSelfie]);

  const displayPreview =
    mode === 'url' && urlValue.trim() ? urlValue.trim() : previewUrl;

  return (
    <div className="grid gap-3 rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white p-4">
      <div>
        <p className="m-0 text-[0.82rem] font-extrabold text-brand-navy">{label}</p>
        <p className="m-0 mt-1 text-[0.78rem] text-brand-muted">{hint}</p>
      </div>

      <ModeTabs
        mode={mode}
        disabled={disabled}
        onChange={(next) => {
          onClear();
          onModeChange(next);
        }}
      />

      {mode === 'upload' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-[10px] border border-[rgba(23,44,113,0.16)] bg-[rgba(248,250,255,0.9)] px-4 py-2 text-[0.82rem] font-bold text-brand-navy disabled:opacity-60"
        >
          Choose JPEG file
        </button>
      ) : null}

      {mode === 'selfie' && selfieActive ? (
        <div className="grid gap-2">
          {cameraError ? <p className="m-0 text-[0.78rem] font-bold text-[#991b1b]">{cameraError}</p> : null}
          <button
            type="button"
            disabled={disabled || !cameraReady}
            onClick={onCaptureSelfie}
            className="cursor-pointer rounded-[10px] bg-brand-blue px-4 py-2 text-[0.82rem] font-bold text-white disabled:opacity-60"
          >
            {cameraReady ? 'Capture selfie' : 'Starting camera…'}
          </button>
        </div>
      ) : null}

      {mode === 'url' ? (
        <label className="grid gap-1.5">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-brand-muted">Image URL</span>
          <input
            type="url"
            value={urlValue}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={disabled}
            placeholder="https://… publicly reachable JPEG/PNG"
            className="los-input h-[40px] text-[0.84rem]"
          />
        </label>
      ) : null}

      {displayPreview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayPreview}
            alt={label}
            className="max-h-48 w-full rounded-[10px] object-contain bg-[rgba(248,250,255,0.9)]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-[10px] border border-dashed border-[rgba(23,44,113,0.14)] bg-[rgba(248,250,255,0.65)] text-[0.78rem] text-brand-muted">
          {mode === 'url' ? 'Enter a public image URL' : mode === 'selfie' ? 'Capture from webcam' : 'No image selected'}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,.jpg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!file.type.toLowerCase().includes('jpeg') && !file.type.toLowerCase().includes('jpg')) return;
          onFile(file, URL.createObjectURL(file));
        }}
      />
    </div>
  );
}

function useFaceMatchSide() {
  const [mode, setMode] = useState<InputMode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  const clear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setUrl('');
  }, []);

  const ready: SideReady | null =
    mode === 'url'
      ? url.trim()
        ? { kind: 'url', url: url.trim() }
        : null
      : file && preview
        ? { kind: 'file', file, preview }
        : null;

  return {
    mode,
    setMode,
    file,
    setFile,
    preview,
    setPreview,
    url,
    setUrl,
    clear,
    ready,
  };
}

export function KycFaceMatchCheckPanel() {
  const reference = useFaceMatchSide();
  const probe = useFaceMatchSide();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [selfieSide, setSelfieSide] = useState<SideKey | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LosFaceMatchCheckResult | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const needsCamera =
    reference.mode === 'selfie' || probe.mode === 'selfie';

  useEffect(() => {
    if (!needsCamera) {
      stopCamera();
      setSelfieSide(null);
      return;
    }

    const activeSide: SideKey =
      reference.mode === 'selfie' ? 'reference' : probe.mode === 'selfie' ? 'probe' : 'reference';
    setSelfieSide(activeSide);

    let cancelled = false;

    (async () => {
      stopCamera();
      setCameraError(null);
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
  }, [needsCamera, reference.mode, probe.mode, stopCamera]);

  function captureForSide(side: SideKey) {
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
    const file = dataUrlToFile(dataUrl, `${side}.jpg`);
    const target = side === 'reference' ? reference : probe;
    target.setFile(file);
    target.setPreview(dataUrl);
    setCameraError(null);
  }

  async function handleRunCheck() {
    setError(null);
    setResult(null);

    if (!reference.ready || !probe.ready) {
      setError('Provide both images — each side needs an upload, selfie capture, or URL.');
      return;
    }

    const token = getLosToken();
    if (!token) {
      setError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      const out = await runKycFaceMatchCheck(token, {
        reference: reference.ready.kind === 'file' ? reference.ready.file : undefined,
        probe: probe.ready.kind === 'file' ? probe.ready.file : undefined,
        referenceUrl: reference.ready.kind === 'url' ? reference.ready.url : undefined,
        probeUrl: probe.ready.kind === 'url' ? probe.ready.url : undefined,
      });
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Face match check failed.');
    } finally {
      setLoading(false);
    }
  }

  const canRun = Boolean(reference.ready && probe.ready);

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Compare two faces with on-server ML first (<code className="text-[0.8rem]">face-api</code>), then Tenacio when
        local match passes and public URLs are available. For each side choose <strong>Upload image</strong>, capture a{' '}
        <strong>Selfie</strong>, or paste a <strong>URL</strong>.
      </p>

      {error ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{error}</p> : null}

      {needsCamera ? (
        <div className="overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.12)] bg-black aspect-[4/3] max-h-[280px]">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
        </div>
      ) : null}
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid gap-4 lg:grid-cols-2">
        <FaceMatchSideInput
          label="Reference photo (url1)"
          hint="Document / Aadhaar / ID photo"
          mode={reference.mode}
          onModeChange={reference.setMode}
          previewUrl={reference.preview}
          urlValue={reference.url}
          onUrlChange={reference.setUrl}
          onFile={(file, preview) => {
            reference.setFile(file);
            reference.setPreview(preview);
          }}
          onClear={reference.clear}
          disabled={loading}
          selfieActive={selfieSide === 'reference' && reference.mode === 'selfie'}
          onActivateSelfie={() => setSelfieSide('reference')}
          cameraReady={cameraReady}
          onCaptureSelfie={() => captureForSide('reference')}
          cameraError={selfieSide === 'reference' ? cameraError : null}
        />
        <FaceMatchSideInput
          label="Probe photo (url2)"
          hint="Live selfie or second face to compare"
          mode={probe.mode}
          onModeChange={probe.setMode}
          previewUrl={probe.preview}
          urlValue={probe.url}
          onUrlChange={probe.setUrl}
          onFile={(file, preview) => {
            probe.setFile(file);
            probe.setPreview(preview);
          }}
          onClear={probe.clear}
          disabled={loading}
          selfieActive={selfieSide === 'probe' && probe.mode === 'selfie'}
          onActivateSelfie={() => setSelfieSide('probe')}
          cameraReady={cameraReady}
          onCaptureSelfie={() => captureForSide('probe')}
          cameraError={selfieSide === 'probe' ? cameraError : null}
        />
      </div>

      <button
        type="button"
        disabled={loading || !canRun}
        onClick={() => void handleRunCheck()}
        className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
      >
        {loading ? 'Running face match…' : 'Run face match'}
      </button>

      {result ? (
        <div className="grid gap-4">
          <KycTenacioVendorResult
            result={{
              configured: true,
              ok: result.local.ok,
              httpStatus: null,
              vendor: result.local,
              businessOk: result.local.matchPassed,
              summary: {},
            }}
            sectionTitle="Local ML (face-api)"
            rawJsonLabel="Local inspection JSON"
            showHttpRows={false}
            passLabel="Local face match would pass"
            failLabel="Local face match would fail"
            extraRows={buildLocalFaceMatchExtraRows(result.local)}
          />
          {result.local.reason && !result.local.matchPassed ? (
            <p className="m-0 text-[0.84rem] leading-[1.5] text-brand-text">{result.local.reason}</p>
          ) : null}
          {result.tenacio ? (
            <KycTenacioVendorResult
              result={result.tenacio}
              sectionTitle="Tenacio vendor"
              passLabel="Tenacio face match would pass"
              failLabel="Tenacio face match would fail"
              extraRows={buildFaceMatchExtraRows(result.tenacio)}
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
            Overall: {result.businessOk ? 'Would pass (local + Tenacio when run)' : 'Would fail'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
