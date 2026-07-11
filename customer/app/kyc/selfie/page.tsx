'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { ActiveLivenessCapture } from '@/components/kyc/active-liveness-capture';
import { KycFacePipelineSteps } from '@/components/kyc/kyc-face-pipeline-steps';
import { KycJourneyLeftPanel } from '@/components/kyc/kyc-journey-left-panel';
import styles from '@/components/kyc/kyc-hub-flow.module.css';
import { JourneyProgressProvider, useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import { getApiUrl } from '@/lib/api-url';
import { getCustomerJourneyResumePath, hasKycLivenessRetryRemaining, type CustomerSessionResponse } from '@/lib/api/customer-session';
import { kycJourneyProgressFromSession } from '@/lib/kyc-journey-progress';
import { pickLivenessFailureUserMessage, type PostKycLivenessResponse } from '@/lib/api/kyc-face';

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigatingRef = useRef(false);

  const kyc = session?.authenticated === true ? session.kycFaceProgress : null;
  const livenessAttemptsRemaining = useMemo(() => {
    if (!kyc || kyc.livenessPassed) return null;
    const max = kyc.livenessMaxAttempts ?? 3;
    const used = kyc.livenessAttempts ?? 0;
    return Math.max(0, max - used);
  }, [kyc]);
  const livenessAttemptsAllowed = kyc?.livenessMaxAttempts ?? 3;
  const photoHref =
    kyc?.digilockerAadhaarPhotoUrl && session?.authenticated === true
      ? `${getApiUrl()}${kyc.digilockerAadhaarPhotoUrl}`
      : null;

  const continueToNextStep = useCallback(
    async (prefetched?: CustomerSessionResponse) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      const next = prefetched ?? (await refresh());
      if (!next.authenticated) {
        navigatingRef.current = false;
        return;
      }
      router.replace(getCustomerJourneyResumePath(next));
    },
    [refresh, router],
  );

  // If the face step is already done (or not required), skip straight ahead.
  useEffect(() => {
    if (loading || busy || session?.authenticated !== true) return;
    const progress = session.kycFaceProgress;
    if (!progress) return;
    if (
      progress.livenessCheckCompleted &&
      !progress.livenessPassed &&
      !hasKycLivenessRetryRemaining(progress)
    ) {
      router.replace('/thank-you');
      return;
    }
    if (progress.livenessPassed || progress.livenessRequired === false) {
      void continueToNextStep();
    }
  }, [loading, busy, session, router, continueToNextStep]);

  const handleComplete = useCallback(
    async (out: PostKycLivenessResponse) => {
      setError('');
      const failed =
        !out.livenessPassed ||
        out.faceValidationPassed === false ||
        out.expressionAntiSpoofPassed === false ||
        out.activeLivenessPassed === false ||
        out.faceMatchPassed === false;

      if (!failed) {
        setBusy(true);
        const nextSession = await refresh();
        if (!nextSession.authenticated) {
          setBusy(false);
          return;
        }
        await continueToNextStep(nextSession);
        return;
      }

      // Attempts exhausted → escalate to the thank-you page.
      if (out.internalError) {
        await refresh();
        router.replace('/thank-you');
        return;
      }

      const baseMessage = pickLivenessFailureUserMessage(out);
      const remaining = out.attemptsRemaining;
      setError(
        typeof remaining === 'number' && remaining > 0
          ? `${baseMessage} You have ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : baseMessage,
      );
      await refresh();
    },
    [continueToNextStep, refresh, router],
  );

  if (loading || !session || session.authenticated !== true) {
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

  const form = kyc?.digilockerAadhaarForm;
  const entries = shallowStringEntries(form);

  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <KycSelfieShell session={session}>
          <div className="grid max-w-xl gap-4">
            <header>
              <p className={`m-0 ${styles.eyebrow}`}>KYC</p>
              <h1 className={styles.rightTitle}>Quick face verification</h1>
              <p className="m-0 mt-1 text-sm text-brand-muted">
                Look at the camera, turn your head, and smile — we match you to your Aadhaar photo and check
                that you are live.
              </p>
            </header>

            <div className="grid gap-2">
              <p className="m-0 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Verification steps
              </p>
              <KycFacePipelineSteps />
            </div>

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

            {busy ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/80 p-4">
                <Spinner size={28} />
                <p className="m-0 text-sm font-semibold text-brand-navy">Verified — continuing…</p>
              </div>
            ) : (
              <ActiveLivenessCapture
                onComplete={handleComplete}
                attemptsRemaining={livenessAttemptsRemaining}
                attemptsAllowed={livenessAttemptsAllowed}
              />
            )}
          </div>
        </KycSelfieShell>
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
