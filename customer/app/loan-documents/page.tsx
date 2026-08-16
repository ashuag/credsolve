'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { LoanDocumentScrollPanel } from '@/components/loan-documents/loan-document-scroll-panel';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LoanCalculationLeftRail } from '@/components/loan/loan-calculation-left-rail';
import { JourneyProgressProvider, useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import {
  acknowledgeLoanDocuments,
  fetchLoanDocuments,
  type LoanDocumentItem,
} from '@/lib/api/loan-documents';
import { CUSTOMER_EMAIL_JOURNEY_PATH, getCustomerJourneyResumePath } from '@/lib/api/customer-session';
import { buildCustomerJourneyProgress } from '@/lib/customer-journey-progress';
import { useCustomerSession } from '@/components/providers/customer-session-provider';

function LoanDocumentsProgressSync() {
  const journey = useJourneyProgressOptional();
  const { session } = useCustomerSession();

  useEffect(() => {
    const progress = buildCustomerJourneyProgress(session);
    journey?.setCompletion01(Math.min(1, progress.percent / 100 + 0.05));
  }, [journey, session]);

  return null;
}

function LoanDocumentsContent() {
  const router = useRouter();
  const { session, refresh: refreshSession } = useCustomerSession();
  const loanSelection = session?.authenticated === true ? session.loanSelection : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<LoanDocumentItem[]>([]);
  const [readyByType, setReadyByType] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchLoanDocuments();
        if (!active) return;
        if (data.reviewed || data.accepted) {
          const updated = await refreshSession();
          router.replace(getCustomerJourneyResumePath(updated));
          return;
        }
        setDocuments(data.documents);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load documents.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshSession, router]);

  const current = documents[0];
  const allReviewed =
    documents.length > 0 && documents.every((d) => readyByType[d.type] === true);

  async function handleContinue() {
    if (!allReviewed) return;
    setError('');
    setIsSubmitting(true);
    try {
      await acknowledgeLoanDocuments();
      const updated = await refreshSession();
      router.push(getCustomerJourneyResumePath(updated));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to continue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const journeyPanel = (
    <div className="flex w-full min-w-0 flex-1 flex-col lg:justify-center">
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size={48} />
          <p className="font-medium text-slate-500">Preparing your loan documents…</p>
        </div>
      ) : current ? (
        <div className="flex w-full min-w-0 flex-1 flex-col gap-5 pb-2 lg:gap-4 lg:pb-0">
          <div>
            <p className="mc-chip mb-3">Sanction letter</p>
            <h1 className="mb-2 text-2xl font-extrabold leading-[1.1] tracking-tight text-brand-navy md:text-[2.1rem]">
              Review your sanction letter
            </h1>
            {error ? (
              <div className="mt-3">
                <AlertBanner variant="error">{error}</AlertBanner>
              </div>
            ) : null}
          </div>

          <LoanDocumentScrollPanel
            key={current.type}
            title={current.title}
            pdfUrlFragment={current.pdfUrl}
            onReadyChange={(next) =>
              setReadyByType((prev) => ({ ...prev, [current.type]: next }))
            }
          />

          <div className="sticky bottom-0 z-20 -mx-5 mt-auto border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-2 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
            <button
              type="button"
              disabled={!allReviewed || isSubmitting}
              onClick={() => void handleContinue()}
              className="mc-btn-primary w-full shrink-0 py-4"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Spinner size={20} /> Continuing…
                </span>
              ) : (
                'Continue to KYC'
              )}
            </button>
          </div>
        </div>
      ) : (
        <AlertBanner variant="error">{error || 'No documents available.'}</AlertBanner>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#fffdf8] selection:bg-[#ffc519]/30 lg:h-full lg:min-h-0 lg:bg-transparent">
      <LoanDocumentsProgressSync />
      <main className="relative flex w-full grow flex-col items-center justify-start p-0 lg:h-full lg:min-h-0 lg:justify-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute top-0 left-1/2 h-[600px] w-[100vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,_rgba(20,150,243,0.06)_0%,_transparent_60%)]" />
        </div>

        <LoanLandingShell
          fullBleedPanel
          showSpeedometer
          journeyPanel={journeyPanel}
          leftTitle={
            <>
              KYC <span className="text-[#60a5fa]">letter</span>
            </>
          }
          leftDescription="Review your sanction letter and Key Fact Statement. You will eSign after references."
          leftInfographic={<LoanCalculationLeftRail loanSelection={loanSelection} />}
          mobileStepLabel="Letter"
          mobileOnBack={() => router.push(CUSTOMER_EMAIL_JOURNEY_PATH)}
        />
      </main>
    </div>
  );
}

export default function LoanDocumentsPage() {
  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <LoanDocumentsContent />
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
