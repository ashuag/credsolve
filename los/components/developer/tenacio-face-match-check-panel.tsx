'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';
import { runTenacioFaceMatchCheck, type TenacioFaceCheckResult } from '@/lib/api/tenacio-face-checks';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';

type InputMode = 'upload' | 'selfie' | 'link';
type SideKey = 'reference' | 'probe';

type SideReady = { kind: 'file'; file: File } | { kind: 'url'; url: string };

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
    { id: 'upload', label: 'Upload photo' },
    { id: 'selfie', label: 'Selfie' },
    { id: 'link', label: 'Link' },
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
    mode === 'link' ? (url.trim() ? { kind: 'url', url: url.trim() } : null) : file ? { kind: 'file', file } : null;

  return { mode, setMode, file, setFile, preview, setPreview, url, setUrl, clear, ready };
}

function FaceMatchSideInput({
  label,
  hint,
  side,
  disabled,
  selfieActive,
  onActivateSelfie,
  cameraReady,
  onCaptureSelfie,
  cameraError,
}: {
  label: string;
  hint: string;
  side: ReturnType<typeof useFaceMatchSide>;
  disabled: boolean;
  selfieActive: boolean;
  onActivateSelfie: () => void;
  cameraReady: boolean;
  onCaptureSelfie: () => void;
  cameraError: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (side.mode === 'selfie') onActivateSelfie();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side.mode]);

  const displayPreview = side.mode === 'link' && side.url.trim() ? side.url.trim() : side.preview;

  return (
    <div className="grid gap-3 rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white p-4">
      <div>
        <p className="m-0 text-[0.82rem] font-extrabold text-brand-navy">{label}</p>
        <p className="m-0 mt-1 text-[0.78rem] text-brand-muted">{hint}</p>
      </div>

      <ModeTabs
        mode={side.mode}
        disabled={disabled}
        onChange={(next) => {
          side.clear();
          side.setMode(next);
        }}
      />

      {side.mode === 'upload' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-[10px] border border-[rgba(23,44,113,0.16)] bg-[rgba(248,250,255,0.9)] px-4 py-2 text-[0.82rem] font-bold text-brand-navy disabled:opacity-60"
        >
          Choose photo
        </button>
      ) : null}

      {side.mode === 'selfie' && selfieActive ? (
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

      {side.mode === 'link' ? (
        <label className="grid gap-1.5">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-brand-muted">Image URL</span>
          <input
            type="url"
            value={side.url}
            onChange={(e) => side.setUrl(e.target.value)}
            disabled={disabled}
            placeholder="https://… publicly reachable photo"
            className="los-input h-[40px] text-[0.84rem]"
          />
        </label>
      ) : null}

      {displayPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayPreview}
          alt={label}
          className="max-h-40 w-full rounded-[10px] object-contain bg-[rgba(248,250,255,0.9)]"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : side.mode !== 'selfie' ? (
        <div className="flex h-32 items-center justify-center rounded-[10px] border border-dashed border-[rgba(23,44,113,0.14)] bg-[rgba(248,250,255,0.65)] text-[0.78rem] text-brand-muted">
          {side.mode === 'link' ? 'Enter a public image URL' : 'No photo selected'}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (!picked) return;
          side.setFile(picked);
          side.setPreview(URL.createObjectURL(picked));
        }}
      />
    </div>
  );
}

export function TenacioFaceMatchCheckPanel() {
  const reference = useFaceMatchSide();
  const probe = useFaceMatchSide();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [selfieSide, setSelfieSide] = useState<SideKey | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TenacioFaceCheckResult | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const needsCamera = reference.mode === 'selfie' || probe.mode === 'selfie';

  useEffect(() => {
    if (!needsCamera) {
      stopCamera();
      setSelfieSide(null);
      return;
    }

    const activeSide: SideKey = reference.mode === 'selfie' ? 'reference' : probe.mode === 'selfie' ? 'probe' : 'reference';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const canRun = Boolean(reference.ready && probe.ready);

  async function handleRunCheck() {
    setError(null);
    setResult(null);

    if (!reference.ready || !probe.ready) {
      setError('Provide both photos — each side needs an upload, selfie capture, or link.');
      return;
    }

    const token = getLosToken();
    if (!token) {
      setError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      const out = await runTenacioFaceMatchCheck(token, {
        file1: reference.ready.kind === 'file' ? reference.ready.file : undefined,
        file2: probe.ready.kind === 'file' ? probe.ready.file : undefined,
        url1: reference.ready.kind === 'url' ? reference.ready.url : undefined,
        url2: probe.ready.kind === 'url' ? probe.ready.url : undefined,
        consent,
      });
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tenacio face match check failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Live Tenacio face-match check, calling{' '}
        <code className="font-mono text-[0.8rem]">TENACIO_KYC_FACE_MATCH_*</code> directly. Tenacio fetches both
        photos itself from public URLs — uploaded/captured photos are first pushed to S3 and resolved to URLs
        before the call. The call is audited in <code className="font-mono text-[0.8rem]">vendor_api_log</code>; no
        lead or KYC record is created or updated.
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
          label="Reference photo (e.g. Aadhaar)"
          hint="Document / reference photo — sent as url1"
          side={reference}
          disabled={loading}
          selfieActive={selfieSide === 'reference' && reference.mode === 'selfie'}
          onActivateSelfie={() => setSelfieSide('reference')}
          cameraReady={cameraReady}
          onCaptureSelfie={() => captureForSide('reference')}
          cameraError={selfieSide === 'reference' ? cameraError : null}
        />
        <FaceMatchSideInput
          label="Selfie photo"
          hint="Live selfie — sent as url2"
          side={probe}
          disabled={loading}
          selfieActive={selfieSide === 'probe' && probe.mode === 'selfie'}
          onActivateSelfie={() => setSelfieSide('probe')}
          cameraReady={cameraReady}
          onCaptureSelfie={() => captureForSide('probe')}
          cameraError={selfieSide === 'probe' ? cameraError : null}
        />
      </div>

      <label className="flex w-fit items-center gap-2 text-[0.84rem] font-bold text-brand-navy">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Customer consent for the face match
      </label>

      <button
        type="button"
        disabled={loading || !canRun || !consent}
        onClick={() => void handleRunCheck()}
        className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
      >
        {loading ? 'Checking…' : 'Run Tenacio face match'}
      </button>

      {result ? (
        <div
          className={cx(
            'rounded-[14px] border px-4 py-4',
            !result.configured
              ? 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.06)]'
              : result.ok
                ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)]'
                : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)]',
          )}
        >
          <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
            Tenacio result
          </p>
          <p className="m-0 mt-1 text-[1.15rem] font-extrabold text-brand-navy">
            {!result.configured ? 'Not configured' : result.ok ? 'Check succeeded' : 'Check failed'}
          </p>

          {result.skipReason ? (
            <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-brand-text">{result.skipReason}</p>
          ) : null}

          <dl className="m-0 mt-3 grid gap-2 text-[0.82rem]">
            <div className="grid grid-cols-[minmax(0,0.42fr)_1fr] gap-2">
              <dt className="text-brand-muted">HTTP status</dt>
              <dd className="m-0 font-mono">{result.httpStatus ?? '—'}</dd>
            </div>
          </dl>

          {result.vendorBody != null ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-[0.82rem] font-bold text-brand-navy">
                Vendor response body
              </summary>
              <pre className="mt-2 max-h-[480px] overflow-auto rounded-[10px] bg-[rgba(248,250,255,0.9)] p-3 text-[0.72rem] leading-[1.4] text-brand-text">
                {JSON.stringify(result.vendorBody, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
