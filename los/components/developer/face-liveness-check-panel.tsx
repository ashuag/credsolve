'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';
import { runFaceLivenessCheck, type FaceLivenessCheckResult } from '@/lib/api/face-liveness-check';
import { openUserCamera, openUserCameraErrorMessage } from '@/lib/media/open-user-camera';

type InputMode = 'upload' | 'selfie' | 'link';

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
    { id: 'upload', label: 'Upload file' },
    { id: 'selfie', label: 'Selfie' },
    { id: 'link', label: 'Link' },
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] border border-[rgba(15,39,72,0.1)] bg-[rgba(248,250,255,0.8)] p-1">
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

export function FaceLivenessCheckPanel() {
  const [mode, setMode] = useState<InputMode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [usePdf, setUsePdf] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FaceLivenessCheckResult | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (mode !== 'selfie') {
      stopCamera();
      return;
    }

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
  }, [mode, stopCamera]);

  function clearInputs() {
    setFile(null);
    setPreview(null);
    setLink('');
  }

  function captureSelfie() {
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
    setFile(dataUrlToFile(dataUrl, 'selfie.jpg'));
    setPreview(dataUrl);
    setCameraError(null);
  }

  const ready = mode === 'link' ? Boolean(link.trim()) : Boolean(file);

  async function handleRunCheck() {
    setError(null);
    setResult(null);

    if (!ready) {
      setError('Provide a file, a captured selfie, or a link.');
      return;
    }

    const token = getLosToken();
    if (!token) {
      setError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      const out = await runFaceLivenessCheck(token, {
        file: mode === 'link' ? undefined : (file ?? undefined),
        link: mode === 'link' ? link.trim() : undefined,
        usePdf,
      });
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Face liveness check failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Live Surepass face-liveness check (<code className="font-mono text-[0.8rem]">POST /face/face-liveness</code>
        ), bypassing any lead/KYC flow. The call is audited in{' '}
        <code className="font-mono text-[0.8rem]">vendor_api_log</code>; no lead or KYC record is created or
        updated. Choose <strong>Upload file</strong>, capture a <strong>Selfie</strong>, or paste a{' '}
        <strong>Link</strong>.
      </p>

      {error ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{error}</p> : null}

      <div className="grid gap-3 rounded-[14px] border border-[rgba(15,39,72,0.1)] bg-white p-4 max-w-md">
        <ModeTabs
          mode={mode}
          disabled={loading}
          onChange={(next) => {
            clearInputs();
            setMode(next);
          }}
        />

        {mode === 'upload' ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-[10px] border border-[rgba(15,39,72,0.16)] bg-[rgba(248,250,255,0.9)] px-4 py-2 text-[0.82rem] font-bold text-brand-navy disabled:opacity-60"
          >
            Choose image or PDF
          </button>
        ) : null}

        {mode === 'selfie' ? (
          <div className="grid gap-2">
            <div className="overflow-hidden rounded-[12px] border border-[rgba(15,39,72,0.12)] bg-black aspect-[4/3] max-h-[280px]">
              <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
            </div>
            {cameraError ? <p className="m-0 text-[0.78rem] font-bold text-[#991b1b]">{cameraError}</p> : null}
            <button
              type="button"
              disabled={loading || !cameraReady}
              onClick={captureSelfie}
              className="cursor-pointer rounded-[10px] bg-brand-blue px-4 py-2 text-[0.82rem] font-bold text-white disabled:opacity-60"
            >
              {cameraReady ? 'Capture selfie' : 'Starting camera…'}
            </button>
          </div>
        ) : null}

        {mode === 'link' ? (
          <label className="grid gap-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-brand-muted">Image URL</span>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={loading}
              placeholder="https://… publicly reachable image"
              className="los-input h-[40px] text-[0.84rem]"
            />
          </label>
        ) : null}

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected"
            className="max-h-48 w-full rounded-[10px] object-contain bg-[rgba(248,250,255,0.9)]"
          />
        ) : mode !== 'selfie' ? (
          <div className="flex h-36 items-center justify-center rounded-[10px] border border-dashed border-[rgba(15,39,72,0.14)] bg-[rgba(248,250,255,0.65)] text-[0.78rem] text-brand-muted">
            {mode === 'link' ? 'Enter a public image URL' : 'No file selected'}
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-[0.82rem] font-bold text-brand-navy">
          <input
            type="checkbox"
            checked={usePdf}
            disabled={loading || mode === 'link'}
            onChange={(e) => setUsePdf(e.target.checked)}
          />
          Treat uploaded file as PDF (use_pdf)
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            setFile(picked);
            setPreview(picked.type === 'application/pdf' ? null : URL.createObjectURL(picked));
          }}
        />
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <button
        type="button"
        disabled={loading || !ready}
        onClick={() => void handleRunCheck()}
        className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
      >
        {loading ? 'Checking…' : 'Run face-liveness check'}
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
            Surepass result
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
