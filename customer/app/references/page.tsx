'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { AlertBanner } from '@/components/ui/alert-banner';
import { FlowLoader } from '@/components/ui/flow-loader';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { OtpInputGrid } from '@/components/ui/otp-input-grid';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { fetchCustomerReferenceRelationLookupValues } from '@/lib/api/lookup';
import { saveLeadReferences } from '@/lib/api/lead';
import {
  acceptLoanDocuments,
  sendLoanDocumentsOtp,
  type SendLoanDocumentsOtpResponse,
} from '@/lib/api/loan-documents';
import { cn } from '@/lib/cn';
import { useCountdown } from '@/lib/hooks/use-countdown';
import { useOtpInput } from '@/lib/hooks/use-otp-input';
import {
  isValidPersonName,
  PERSON_NAME_VALIDATION_MESSAGE,
  personNamesMatch,
  sanitizePersonNameInput,
} from '@/lib/validators';

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
const OTP_LENGTH = 6;

type ReferenceForm = {
  fullName: string;
  mobileNumber: string;
  relationId: string;
};

const EMPTY_REF: ReferenceForm = { fullName: '', mobileNumber: '', relationId: '' };

function referencesFromSession(
  saved: Array<{ referenceIndex: number; fullName: string; mobileNumber: string; relationId: number }>,
): [ReferenceForm, ReferenceForm] {
  const next: [ReferenceForm, ReferenceForm] = [{ ...EMPTY_REF }, { ...EMPTY_REF }];
  for (const row of saved) {
    const index = row.referenceIndex - 1;
    if (index !== 0 && index !== 1) continue;
    next[index] = {
      fullName: row.fullName.trim(),
      mobileNumber: row.mobileNumber.trim(),
      relationId: String(row.relationId),
    };
  }
  return next;
}

function inputClass(hasError: boolean) {
  return cn(
    'mc-autofill-fix w-full h-[48px] rounded-xl border px-3',
    'bg-white text-slate-900 text-[0.95rem] font-semibold outline-none transition-all',
    'placeholder:text-slate-400 placeholder:font-normal',
    'focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm',
    hasError ? 'border-red-400 focus:ring-red-500/10' : 'border-slate-200',
  );
}

export default function ReferencesPage() {
  const router = useRouter();
  const { session, refresh } = useCustomerSession();
  const [refs, setRefs] = useState<[ReferenceForm, ReferenceForm]>([EMPTY_REF, { ...EMPTY_REF }]);
  const [relationOptions, setRelationOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingRelations, setLoadingRelations] = useState(true);
  const [errors, setErrors] = useState<Array<Partial<Record<keyof ReferenceForm, string>>>>([{}, {}]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phase, setPhase] = useState<'form' | 'otp'>('form');
  const [otpRequest, setOtpRequest] = useState<SendLoanDocumentsOtpResponse | null>(null);
  const [otpError, setOtpError] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const hydratedFromSessionRef = useRef(false);
  const otpAutoStartedRef = useRef(false);

  const otp = useOtpInput(() => {
    setOtpError('');
    setOtpStatus('');
  });
  const resendCountdown = useCountdown(otpRequest?.resendAvailableAt);

  useEffect(() => {
    if (hydratedFromSessionRef.current) return;
    if (session?.authenticated !== true || !session.leadReferences?.length) return;
    setRefs(referencesFromSession(session.leadReferences));
    hydratedFromSessionRef.current = true;
  }, [session]);

  useEffect(() => {
    let active = true;
    void fetchCustomerReferenceRelationLookupValues()
      .then((values) => {
        if (!active) return;
        setRelationOptions(values.filter((v) => Number.isFinite(v.id)));
      })
      .catch(() => {
        if (!active) return;
        setRelationOptions([]);
      })
      .finally(() => {
        if (active) setLoadingRelations(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Resume: refs saved but sanctioned OTP not done yet.
  useEffect(() => {
    if (otpAutoStartedRef.current) return;
    if (session?.authenticated !== true) return;
    if (!session.journey.referencesCompleted || session.journey.loanDocumentsAccepted) return;
    otpAutoStartedRef.current = true;
    void startOtpPhase();
  }, [session]);

  function updateRef(index: 0 | 1, field: keyof ReferenceForm, value: string) {
    const nextValue = field === 'fullName' ? sanitizePersonNameInput(value) : value;
    setRefs((current) => {
      const next: [ReferenceForm, ReferenceForm] = [...current] as [ReferenceForm, ReferenceForm];
      next[index] = { ...next[index], [field]: nextValue };
      return next;
    });
    setErrors((current) => {
      const next = [...current] as [
        Partial<Record<keyof ReferenceForm, string>>,
        Partial<Record<keyof ReferenceForm, string>>,
      ];
      if (next[index][field]) {
        next[index] = { ...next[index], [field]: undefined };
      }
      return next;
    });
  }

  function validate(): boolean {
    const nextErrors: Array<Partial<Record<keyof ReferenceForm, string>>> = [{}, {}];
    const mobiles: string[] = [];
    const customerMobile = session?.authenticated
      ? session.mobileNumber.replace(/\D/g, '').slice(-10)
      : '';
    const customerName = session?.authenticated ? session.profile?.fullName?.trim() ?? '' : '';

    refs.forEach((ref, index) => {
      if (!isValidPersonName(ref.fullName)) {
        nextErrors[index]!.fullName =
          ref.fullName.trim().length === 0 ? 'Enter the reference name.' : PERSON_NAME_VALIDATION_MESSAGE;
      } else if (customerName && personNamesMatch(ref.fullName, customerName)) {
        nextErrors[index]!.fullName = 'Reference name cannot match your name.';
      }
      const mobile = ref.mobileNumber.replace(/\D/g, '').slice(0, 10);
      if (!INDIAN_MOBILE_RE.test(mobile)) {
        nextErrors[index]!.mobileNumber = 'Enter a valid 10-digit mobile number.';
      } else if (mobile === customerMobile) {
        nextErrors[index]!.mobileNumber = 'Reference mobile cannot match your mobile number.';
      } else if (mobiles.includes(mobile)) {
        nextErrors[index]!.mobileNumber = 'Each reference needs a different mobile number.';
      } else {
        mobiles.push(mobile);
      }
      if (!ref.relationId) {
        nextErrors[index]!.relationId = 'Select a relation.';
      }
    });

    setErrors(nextErrors);
    return nextErrors.every((item) => Object.keys(item).length === 0);
  }

  async function startOtpPhase() {
    setPhase('otp');
    setIsSendingOtp(true);
    setOtpError('');
    setOtpStatus('');
    try {
      const req = await sendLoanDocumentsOtp();
      setOtpRequest(req);
      setOtpStatus(
        req.debugOtp
          ? `Development OTP: ${req.debugOtp}`
          : `We sent a 6-digit code to ${req.maskedMobile}.`,
      );
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : 'Unable to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleResendOtp() {
    if (resendCountdown > 0 || isSendingOtp) return;
    otp.clear();
    setIsSendingOtp(true);
    setOtpError('');
    setOtpStatus('');
    try {
      const req = await sendLoanDocumentsOtp();
      setOtpRequest(req);
      setOtpStatus(req.debugOtp ? `Development OTP: ${req.debugOtp}` : 'A new code has been sent.');
      otp.inputRefs.current[0]?.focus();
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : 'Unable to resend OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!otpRequest || otp.joined.length !== OTP_LENGTH) return;
    setIsVerifying(true);
    setOtpError('');
    try {
      await acceptLoanDocuments(otpRequest.requestId, otp.joined);
      if (refresh) await refresh();
      router.push('/thank-you');
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Incorrect OTP. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    const leadUuid = session?.authenticated && session.lead ? session.lead.uuid : undefined;
    if (!leadUuid) {
      setSubmitError('Session expired. Please sign in again.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await saveLeadReferences({
        leadUuid,
        references: [
          {
            fullName: refs[0].fullName.trim(),
            mobileNumber: refs[0].mobileNumber.replace(/\D/g, '').slice(0, 10),
            relationId: Number(refs[0].relationId),
          },
          {
            fullName: refs[1].fullName.trim(),
            mobileNumber: refs[1].mobileNumber.replace(/\D/g, '').slice(0, 10),
            relationId: Number(refs[1].relationId),
          },
        ],
      });
      if (refresh) {
        await refresh();
      }
      if (result.needsSanctionOtp !== false) {
        otpAutoStartedRef.current = true;
        await startOtpPhase();
      } else {
        router.push('/thank-you');
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save references. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const journeyPanel =
    phase === 'otp' ? (
      <form onSubmit={handleVerifyOtp} className="flex w-full min-w-0 flex-col gap-6">
        <div>
          <h2 className="text-xl md:text-[1.8rem] font-bold text-brand-navy mb-2 tracking-tight leading-[1.1]">
            Confirm with <span className="text-brand-blue">OTP</span>
          </h2>
          <p className="m-0 text-[0.88rem] text-slate-600 leading-relaxed">
            Enter the code sent to your mobile to receive your signed sanctioned letter and finish your
            application.
          </p>
          {session?.authenticated === true && session.journey.bankVerificationFailed ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 leading-relaxed">
              After you submit, one of our representatives will call you about bank verification.
            </div>
          ) : null}
        </div>
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
          {isVerifying ? 'Verifying…' : 'Verify & submit application'}
        </button>
        <button
          type="button"
          disabled={resendCountdown > 0 || isSendingOtp}
          onClick={() => void handleResendOtp()}
          className="text-sm font-semibold text-brand-blue disabled:text-slate-400"
        >
          {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
        </button>
        {isSendingOtp ? (
          <FlowLoader
            eyebrow="OTP"
            title="Sending verification code"
            description="We are sending a one-time password to your registered mobile."
            steps={['Preparing OTP', 'Sending SMS', 'Almost ready']}
          />
        ) : null}
      </form>
    ) : (
      <section className="h-full flex flex-col">
        <div className="mb-4">
          <h2 className="text-xl md:text-[1.8rem] font-bold text-brand-navy mb-2 tracking-tight leading-[1.1]">
            Personal <span className="text-brand-blue">References</span>
          </h2>
          <p className="m-0 text-[0.88rem] text-slate-600 leading-relaxed">
            Add two people we can contact. Their name and mobile cannot match yours. Next you will verify one
            OTP to receive your sanctioned letter and submit your application.
          </p>
          {session?.authenticated === true && session.journey.bankVerificationFailed ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 leading-relaxed">
              Bank verification could not be completed automatically. Finish these steps — one of our
              representatives will call you after you submit.
            </div>
          ) : null}
        </div>

        {submitError ? (
          <div className="mb-4">
            <AlertBanner variant="error">{submitError}</AlertBanner>
          </div>
        ) : null}

        <form className="grid gap-5" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {([0, 1] as const).map((index) => (
            <div
              key={index}
              className="grid gap-3 rounded-[20px] border border-[rgba(18,36,79,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,255,0.94))] p-4"
            >
              <h3 className="m-0 text-[1rem] font-extrabold text-brand-navy">Reference {index + 1}</h3>

              <label className="grid gap-1.5">
                <span className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1">Name</span>
                <input
                  className={cn(inputClass(Boolean(errors[index]?.fullName)), 'uppercase placeholder:normal-case')}
                  value={refs[index].fullName}
                  onChange={(e) => updateRef(index, 'fullName', e.target.value)}
                  placeholder="Full name"
                  required
                />
                {errors[index]?.fullName ? (
                  <p className="m-0 text-[#b2372d] text-[0.75rem] pl-1">{errors[index].fullName}</p>
                ) : null}
              </label>

              <label className="grid gap-1.5">
                <span className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1">
                  Mobile number
                </span>
                <input
                  className={inputClass(Boolean(errors[index]?.mobileNumber))}
                  value={refs[index].mobileNumber}
                  onChange={(e) => updateRef(index, 'mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  required
                />
                {errors[index]?.mobileNumber ? (
                  <p className="m-0 text-[#b2372d] text-[0.75rem] pl-1">{errors[index].mobileNumber}</p>
                ) : null}
              </label>

              <label className="grid gap-1.5">
                <span className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1">Relation</span>
                <select
                  className={inputClass(Boolean(errors[index]?.relationId))}
                  value={refs[index].relationId}
                  onChange={(e) => updateRef(index, 'relationId', e.target.value)}
                  disabled={loadingRelations}
                  required
                >
                  <option value="">Select relation</option>
                  {relationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                {errors[index]?.relationId ? (
                  <p className="m-0 text-[#b2372d] text-[0.75rem] pl-1">{errors[index].relationId}</p>
                ) : null}
              </label>
            </div>
          ))}

          <button type="submit" className="mc-btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Continue — send OTP'}
          </button>
        </form>

        {isSubmitting ? (
          <FlowLoader
            eyebrow="References"
            title="Saving your references"
            description="We are storing your reference contacts securely."
            steps={['Validating numbers', 'Saving references', 'Preparing OTP']}
          />
        ) : null}
      </section>
    );

  return (
    <CustomerJourneyGuard>
      <LoanLandingShell
        showSpeedometer
        journeyPanel={journeyPanel}
        leftTitle={
          <>
            Almost <span className="text-[#60a5fa]">there</span>
          </>
        }
        leftDescription="Two references, then one OTP to receive your sanctioned letter and submit your application."
        mobileStepLabel={phase === 'otp' ? 'OTP' : 'References'}
        mobileOnBack={() => router.push('/bank-details')}
      />
    </CustomerJourneyGuard>
  );
}
