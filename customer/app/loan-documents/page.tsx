'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { LoanDocumentScrollPanel } from '@/components/loan-documents/loan-document-scroll-panel';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LoanCalculationLeftRail } from '@/components/loan/loan-calculation-left-rail';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import {
  acknowledgeLoanDocuments,
  fetchLoanDocuments,
  type LoanDocumentItem,
} from '@/lib/api/loan-documents';
import { CUSTOMER_EMAIL_JOURNEY_PATH, getCustomerJourneyResumePath } from '@/lib/api/customer-session';
import { useCustomerSession } from '@/components/providers/customer-session-provider';

export default function LoanDocumentsPage() {
  const router = useRouter();
  const { session, refresh: refreshSession } = useCustomerSession();
  const loanSelection = session?.authenticated === true ? session.loanSelection : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<LoanDocumentItem[]>([]);
  const [agreedByType, setAgreedByType] = useState<Record<string, boolean>>({});
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
  const allAgreed =
    documents.length > 0 && documents.every((d) => agreedByType[d.type] === true);

  async function handleAgreeAndContinue() {
    if (!allAgreed) return;
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
    <div className="flex w-full min-w-0 flex-col">
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size={48} />
          <p className="text-slate-500 font-medium">Preparing your loan documents…</p>
        </div>
      ) : current ? (
        <div className="flex w-full min-w-0 flex-col gap-4 pb-2">
          <div>
            <h1 className="mb-2 text-2xl font-black text-brand-navy">KYC letter cum Key Fact Statement</h1>
            <p className="mb-2 text-sm text-slate-500">
              Read the full document below. Confirm your agreement to continue to KYC. No OTP is sent here and
              nothing is emailed yet — after references you will verify one OTP to receive your signed sanctioned
              letter.
            </p>
            {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
          </div>
          <LoanDocumentScrollPanel
            key={current.type}
            title={current.title}
            pdfUrlFragment={current.pdfUrl}
            agreed={agreedByType[current.type] === true}
            onAgreedChange={(next) =>
              setAgreedByType((prev) => ({ ...prev, [current.type]: next }))
            }
          />
          <button
            type="button"
            disabled={!allAgreed || isSubmitting}
            onClick={() => void handleAgreeAndContinue()}
            className="mc-btn-primary w-full shrink-0 py-4"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner size={20} /> Continuing…
              </span>
            ) : (
              'I agree — continue to KYC'
            )}
          </button>
        </div>
      ) : (
        <AlertBanner variant="error">{error || 'No documents available.'}</AlertBanner>
      )}
    </div>
  );

  return (
    <CustomerJourneyGuard>
      <div className="flex h-full min-h-0 w-full flex-col">
        <LoanLandingShell
          fullBleedPanel
          journeyPanel={journeyPanel}
          leftTitle={
            <>
              KYC <span className="text-[#60a5fa]">letter</span>
            </>
          }
          leftDescription="Review your KYC letter and Key Fact Statement, then continue to KYC."
          leftInfographic={<LoanCalculationLeftRail loanSelection={loanSelection} />}
          mobileStepLabel="KYC letter"
          mobileOnBack={() => router.push(CUSTOMER_EMAIL_JOURNEY_PATH)}
          showSpeedometer={false}
        />
      </div>
    </CustomerJourneyGuard>
  );
}
