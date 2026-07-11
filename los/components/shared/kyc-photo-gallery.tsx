'use client';

import { resolveLosKycPhotoSrc } from '@/lib/api';
import { useEffect, useState } from 'react';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type LightboxState = { src: string; alt: string; label: string };

export function KycPhotoLightbox({
  src,
  alt,
  label,
  onClose,
}: {
  src: string;
  alt: string;
  label: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,18,40,0.82)] p-4 backdrop-blur-[6px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="relative flex max-h-[92vh] max-w-[min(920px,96vw)] flex-col overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[#0b1428] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
          <p className="m-0 text-[0.88rem] font-bold text-white">{label}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] text-white hover:bg-[rgba(255,255,255,0.12)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[calc(92vh-88px)] max-w-full object-contain" />
        </div>
      </div>
    </div>
  );
}

export function KycPhotoTile({
  label,
  src,
  alt,
  onOpen,
}: {
  label: string;
  src: string;
  alt: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid cursor-pointer gap-2 rounded-[12px] border border-[rgba(23,44,113,0.12)] bg-white p-2 text-left transition-colors hover:border-[rgba(20,150,243,0.35)]"
    >
      <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">{label}</span>
      <span className="relative block overflow-hidden rounded-[10px] bg-[rgba(248,250,255,0.9)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-40 w-full object-contain transition-transform group-hover:scale-[1.02]" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(8,18,40,0.55)] to-transparent px-2 py-1.5 text-[0.68rem] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
          Click to enlarge
        </span>
      </span>
    </button>
  );
}

export function KycLivenessVideoPlayer({
  src,
  label = 'Liveness video (short)',
}: {
  src: string;
  label?: string;
}) {
  return (
    <div className="grid h-full gap-2 rounded-[12px] border border-[rgba(23,44,113,0.12)] bg-white p-2">
      <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
        {label}
      </span>
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="h-40 w-full rounded-[10px] bg-[rgba(8,18,40,0.92)] object-contain"
      >
        Your browser does not support inline video playback.
      </video>
    </div>
  );
}

export function KycPhotoGallery({
  row,
  authToken,
  photoVersion,
}: {
  row: {
    kycPhotos: {
      selfieUrl: string | null;
      aadhaarPhotoUrl: string | null;
      livenessVideoUrl?: string | null;
    };
    updatedAt: string;
  };
  authToken: string | null;
  photoVersion?: string | number | null;
}) {
  const version = photoVersion ?? row.updatedAt;
  const selfieSrc = authToken
    ? resolveLosKycPhotoSrc(row.kycPhotos.selfieUrl, authToken, version)
    : null;
  const aadhaarSrc = authToken
    ? resolveLosKycPhotoSrc(row.kycPhotos.aadhaarPhotoUrl, authToken, version)
    : null;
  const livenessVideoSrc = authToken
    ? resolveLosKycPhotoSrc(row.kycPhotos.livenessVideoUrl ?? null, authToken, version)
    : null;

  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  if (!selfieSrc && !aadhaarSrc && !livenessVideoSrc) {
    return (
      <p className="m-0 text-[0.84rem] text-brand-muted">No KYC photos or liveness video captured yet.</p>
    );
  }

  return (
    <>
      <div
        className={cx(
          'grid gap-3',
          livenessVideoSrc && (aadhaarSrc || selfieSrc)
            ? 'grid-cols-1 md:grid-cols-3'
            : aadhaarSrc && selfieSrc
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1',
        )}
      >
        {aadhaarSrc ? (
          <KycPhotoTile
            label="Aadhaar photo"
            src={aadhaarSrc}
            alt="Aadhaar reference photo"
            onOpen={() => setLightbox({ src: aadhaarSrc, alt: 'Aadhaar reference photo', label: 'Aadhaar photo' })}
          />
        ) : null}
        {selfieSrc ? (
          <KycPhotoTile
            label="Selfie"
            src={selfieSrc}
            alt="Customer selfie"
            onOpen={() => setLightbox({ src: selfieSrc, alt: 'Customer selfie', label: 'Selfie' })}
          />
        ) : null}
        {livenessVideoSrc ? (
          <KycLivenessVideoPlayer src={livenessVideoSrc} />
        ) : null}
      </div>
      {lightbox ? (
        <KycPhotoLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          label={lightbox.label}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </>
  );
}
