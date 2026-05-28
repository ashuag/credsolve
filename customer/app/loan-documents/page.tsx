'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { LoanDocumentScrollPanel } from '@/components/loan-documents/loan-document-scroll-panel';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LoanSummaryLeftRail } from '@/components/loan/loan-summary-left-rail';
import { AlertBanner } from '@/components/ui/alert-banner';
import { OtpInputGrid } from '@/components/ui/otp-input-grid';
import { Spinner } from '@/components/ui/spinner';
import {
  acceptLoanDocuments,
  fetchLoanDocuments,
  sendLoanDocumentsOtp,
  type LoanDocumentItem,
  type SendLoanDocumentsOtpResponse,
} from '@/lib/api/loan-documents';
import { CUSTOMER_EMAIL_JOURNEY_PATH, getCustomerJourneyResumePath } from '@/lib/api/customer-session';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { useCountdown } from '@/lib/hooks/use-countdown';
import { useOtpInput } from '@/lib/hooks/use-otp-input';

const OTP_LENGTH = 6;

export default function LoanDocumentsPage() {
  const router = useRouter();
  const { session, refresh: refreshSession } = useCustomerSession();
  const loanSelection = session?.authenticated === true ? session.loanSelection : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<LoanDocumentItem[]>([]);
  const [docIndex, setDocIndex] = useState(0);
  const [agreedByType, setAgreedByType] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<'review' | 'otp'>('review');
  const [otpRequest, setOtpRequest] = useState<SendLoanDocumentsOtpResponse | null>(null);
  const [otpError, setOtpError] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const otp = useOtpInput(() => {
    setOtpError('');
    setOtpStatus('');
  });
  const resendCountdown = useCountdown(otpRequest?.resendAvailableAt);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchLoanDocuments();
        if (!active) return;
        if (data.accepted) {
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

  const current = documents[docIndex];
  const allAgreed =
    documents.length > 0 && documents.every((d) => agreedByType[d.type] === true);

  async function goToOtpStep() {
    if (!allAgreed) return;
    setError('');
    setIsSendingOtp(true);
    try {
      const req = await sendLoanDocumentsOtp();
      setOtpRequest(req);
      setPhase('otp');
      setOtpStatus(
        req.debugOtp
          ? `Development OTP: ${req.debugOtp}`
          : `We sent a 6-digit code to ${req.maskedMobile}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleResendOtp() {
    if (resendCountdown > 0 || isSendingOtp) return;
    setIsSendingOtp(true);
    setOtpError('');
    try {
      const req = await sendLoanDocumentsOtp();
      setOtpRequest(req);
      setOtpStatus(req.debugOtp ? `Development OTP: ${req.debugOtp}` : 'A new code has been sent.');
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : 'Unable to resend OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpRequest || otp.joined.length !== OTP_LENGTH) return;
    setIsVerifying(true);
    setOtpError('');
    try {
      await acceptLoanDocuments(otpRequest.requestId, otp.joined);
      const updated = await refreshSession();
      router.push(getCustomerJourneyResumePath(updated));
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Incorrect OTP. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  const journeyPanel = (
    <div className="w-full max-w-xl mx-auto">
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size={48} />
          <p className="text-slate-500 font-medium">Preparing your loan documents…</p>
        </div>
      ) : phase === 'otp' ? (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
          <h1 className="text-2xl font-black text-brand-navy">Confirm with OTP</h1>
          <p className="text-slate-500 text-sm">
            Enter the code sent to your registered mobile number to accept the Key Fact Statement and Loan Agreement.
            We will email both documents to your registered email address after verification.
          </p>
          {otpStatus ? <p className="text-sm text-emerald-700 font-medium">{otpStatus}</p> : null}
          {otpError ? <AlertBanner variant="error">{otpError}</AlertBanner> : null}
          <OtpInputGrid
            digits={otp.digits}
            inputRefs={otp.inputRefs}
            onDigitChange={otp.updateDigit}
            onKeyDown={otp.handleKeyDown}
            onPaste={otp.handlePaste}
          />
          <button
            type="submit"
            disabled={isVerifying || otp.joined.length !== OTP_LENGTH}
            className="mc-btn-primary w-full py-4"
          >
            {isVerifying ? 'Verifying…' : 'Verify & continue to KYC'}
          </button>
          <button
            type="button"
            disabled={resendCountdown > 0 || isSendingOtp}
            onClick={() => void handleResendOtp()}
            className="text-sm font-semibold text-brand-blue disabled:text-slate-400"
          >
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
          </button>
          <button
            type="button"
            className="text-sm text-slate-500"
            onClick={() => {
              setPhase('review');
              setOtpError('');
            }}
          >
            Back to documents
          </button>
        </form>
      ) : current ? (
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Document {docIndex + 1} of {documents.length}
          </p>
          <h1 className="text-2xl font-black text-brand-navy mb-2">Sanction letter &amp; agreement</h1>
          <p className="text-sm text-slate-500 mb-6">
            Read the sanction letter (Key Fact Statement) and loan agreement. After both are accepted, we will send an
            OTP to your mobile to confirm. Once verified, both documents will be emailed to your registered email address.
          </p>
          {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
          <LoanDocumentScrollPanel
            key={current.type}
            title={current.title}
            pdfUrlFragment={current.pdfUrl}
            agreed={agreedByType[current.type] === true}
            onAgreedChange={(next) =>
              setAgreedByType((prev) => ({ ...prev, [current.type]: next }))
            }
          />
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {docIndex < documents.length - 1 ? (
              <button
                type="button"
                disabled={!agreedByType[current.type]}
                onClick={() => setDocIndex((i) => i + 1)}
                className="mc-btn-primary flex-1 py-4"
              >
                Next document
              </button>
            ) : (
              <button
                type="button"
                disabled={!allAgreed || isSendingOtp}
                onClick={() => void goToOtpStep()}
                className="mc-btn-primary flex-1 py-4"
              >
                {isSendingOtp ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Spinner size={20} /> Sending OTP…
                  </span>
                ) : (
                  'I agree — send OTP'
                )}
              </button>
            )}
            {docIndex > 0 ? (
              <button
                type="button"
                onClick={() => setDocIndex((i) => i - 1)}
                className="py-4 px-6 rounded-xl font-bold border border-slate-200 text-slate-600"
              >
                Back
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <AlertBanner variant="error">{error || 'No documents available.'}</AlertBanner>
      )}
    </div>
  );

  return (
    <CustomerJourneyGuard>
      <LoanLandingShell
        journeyPanel={journeyPanel}
        leftTitle={
          <>
            Sanction <span className="text-[#60a5fa]">letter</span>
          </>
        }
        leftDescription="Review your sanction letter and loan agreement before identity verification (KYC)."
        leftInfographic={<LoanSummaryLeftRail loanSelection={loanSelection} />}
        mobileStepLabel="Sanction letter"
        mobileOnBack={() => router.push(CUSTOMER_EMAIL_JOURNEY_PATH)}
      />
    </CustomerJourneyGuard>
  );
}
