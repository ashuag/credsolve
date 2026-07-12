'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { AlertBanner } from '@/components/ui/alert-banner';
import { FlowLoader } from '@/components/ui/flow-loader';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { fetchCustomerReferenceRelationLookupValues } from '@/lib/api/lookup';
import { saveLeadReferences } from '@/lib/api/lead';
import { cn } from '@/lib/cn';
import {
  isValidPersonName,
  PERSON_NAME_VALIDATION_MESSAGE,
  sanitizePersonNameInput,
} from '@/lib/validators';

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

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
  const hydratedFromSessionRef = useRef(false);

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

  function updateRef(index: 0 | 1, field: keyof ReferenceForm, value: string) {
    const nextValue = field === 'fullName' ? sanitizePersonNameInput(value) : value;
    setRefs((current) => {
      const next: [ReferenceForm, ReferenceForm] = [...current] as [ReferenceForm, ReferenceForm];
      next[index] = { ...next[index], [field]: nextValue };
      return next;
    });
    setErrors((current) => {
      const next = [...current] as [Partial<Record<keyof ReferenceForm, string>>, Partial<Record<keyof ReferenceForm, string>>];
      if (next[index][field]) {
        next[index] = { ...next[index], [field]: undefined };
      }
      return next;
    });
  }

  function validate(): boolean {
    const nextErrors: Array<Partial<Record<keyof ReferenceForm, string>>> = [{}, {}];
    const mobiles: string[] = [];
    const customerMobile = session?.authenticated ? session.mobileNumber.trim() : '';

    refs.forEach((ref, index) => {
      if (!isValidPersonName(ref.fullName)) {
        nextErrors[index]!.fullName =
          ref.fullName.trim().length === 0 ? 'Enter the reference name.' : PERSON_NAME_VALIDATION_MESSAGE;
      }
      const mobile = ref.mobileNumber.replace(/\D/g, '').slice(0, 10);
      if (!INDIAN_MOBILE_RE.test(mobile)) {
        nextErrors[index]!.mobileNumber = 'Enter a valid 10-digit mobile number.';
      } else if (mobile === customerMobile) {
        nextErrors[index]!.mobileNumber = 'Use a number other than your own mobile.';
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
      await saveLeadReferences({
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
      router.push('/thank-you');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save references. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const journeyPanel = (
    <section className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl md:text-[1.8rem] font-extrabold text-brand-navy mb-2 tracking-tight leading-[1.1]">
          Personal <span className="text-brand-blue">References</span>
        </h2>
        <p className="m-0 text-[0.88rem] text-slate-600 leading-relaxed">
          Add two people we can contact. This is the final step before we submit your application for review.
        </p>
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
              {errors[index]?.fullName ? <p className="m-0 text-[#b2372d] text-[0.75rem] pl-1">{errors[index].fullName}</p> : null}
            </label>

            <label className="grid gap-1.5">
              <span className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1">Mobile number</span>
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
          {isSubmitting ? 'Saving…' : 'Submit application'}
        </button>
      </form>

      {isSubmitting ? (
        <FlowLoader
          eyebrow="References"
          title="Saving your references"
          description="We are storing your reference contacts securely."
          steps={['Validating numbers', 'Saving references', 'Completing your application']}
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
        leftDescription="Two references are the last step after bank verification. Then your application is complete."
        mobileStepLabel="References"
        mobileOnBack={() => router.push('/bank-details')}
      />
    </CustomerJourneyGuard>
  );
}
