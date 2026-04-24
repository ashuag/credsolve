'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { saveKycDocuments } from '@/lib/api/lead';
import { cn } from '@/lib/cn';
import {
  FORM_FIELD_CLASS,
  FORM_FIELD_ERROR_CLASS,
  FORM_FIELD_NORMAL_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
} from '@/lib/form-styles';
import { isValidPan } from '@/lib/validators';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FILES = 'image/*,.pdf,application/pdf';
const AADHAAR_REGEX = /^\d{12}$/;
const FILE_INPUT_CLASS =
  'block w-full text-[0.9rem] text-brand-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[rgba(20,150,243,0.12)] file:px-3 file:py-2 file:font-semibold file:text-brand-navy hover:file:bg-[rgba(20,150,243,0.18)]';

type FieldErrors = {
  panNumber?: string;
  aadhaarNumber?: string;
  panDocument?: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
};

function validateFile(file: File | null, label: string): string | null {
  if (!file?.size) {
    return `Please upload ${label}.`;
  }
  if (file.size > MAX_BYTES) {
    return `${label} must be 5MB or smaller.`;
  }
  return null;
}

function normalizeApiError(message: string): string {
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (
    lower.includes('pannumber must match') ||
    normalized.includes('/^[A-Z]{5}[0-9]{4}[A-Z]$/')
  ) {
    return 'Please enter a valid PAN number (e.g. ABCDE1234F).';
  }

  if (lower.includes('aadhaarnumber') || lower.includes('aadhaar number')) {
    return 'Please enter a valid 12-digit Aadhaar number.';
  }

  return normalized || 'Unable to save KYC documents right now. Please try again.';
}

export default function UploadDocumentsPage() {
  const router = useRouter();
  const { session } = useCustomerSession();
  const storedPan =
    session?.authenticated && session.profile?.panNumber?.trim()
      ? session.profile.panNumber.trim().toUpperCase()
      : '';

  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panDocument, setPanDocument] = useState<File | null>(null);
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (storedPan) {
      setPanNumber(storedPan);
    }
  }, [storedPan]);

  const isPanLocked = Boolean(storedPan);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (submitError) {
      setSubmitError('');
    }
  }

  function handlePanChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
    setPanNumber(next);
    clearFieldError('panNumber');
  }

  function handleAadhaarChange(event: ChangeEvent<HTMLInputElement>) {
    setAadhaarNumber(event.target.value.replace(/\D/g, '').slice(0, 12));
    clearFieldError('aadhaarNumber');
  }

  function handleFileChange(field: keyof Pick<FieldErrors, 'panDocument' | 'aadhaarFront' | 'aadhaarBack'>) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (field === 'panDocument') {
        setPanDocument(file);
      } else if (field === 'aadhaarFront') {
        setAadhaarFront(file);
      } else {
        setAadhaarBack(file);
      }
      clearFieldError(field);
    };
  }

  function validateForm(normalizedPan: string, normalizedAadhaar: string): FieldErrors {
    const errors: FieldErrors = {};

    if (!isValidPan(normalizedPan)) {
      errors.panNumber = 'Please enter a valid PAN number (e.g. ABCDE1234F).';
    }
    if (!AADHAAR_REGEX.test(normalizedAadhaar)) {
      errors.aadhaarNumber = 'Please enter a valid 12-digit Aadhaar number.';
    }

    const panFileError = validateFile(panDocument, 'your PAN card');
    if (panFileError) {
      errors.panDocument = panFileError;
    }

    const aadhaarFrontError = validateFile(aadhaarFront, 'Aadhaar front');
    if (aadhaarFrontError) {
      errors.aadhaarFront = aadhaarFrontError;
    }

    const aadhaarBackError = validateFile(aadhaarBack, 'Aadhaar back');
    if (aadhaarBackError) {
      errors.aadhaarBack = aadhaarBackError;
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');

    const normalizedPan = panNumber.trim().toUpperCase();
    const normalizedAadhaar = aadhaarNumber.replace(/\D/g, '');
    const nextErrors = validateForm(normalizedPan, normalizedAadhaar);

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await saveKycDocuments({
        panNumber: normalizedPan,
        aadhaarNumber: normalizedAadhaar,
        panDocument: panDocument!,
        aadhaarFront: aadhaarFront!,
        aadhaarBack: aadhaarBack!,
      });
      router.push('/bank-details');
    } catch (error) {
      setSubmitError(
        normalizeApiError(error instanceof Error ? error.message : '')
      );
      setIsSubmitting(false);
    }
  }

  return (
    <CustomerJourneyGuard>
      <section className="mc-card mc-card-glow mx-auto max-w-lg">
        <div className="mb-6 grid gap-2">
          <span className="mc-chip w-fit">KYC</span>
          <h1 className="m-0 text-[1.5rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            Upload documents
          </h1>
          <p className="m-0 text-[0.94rem] leading-relaxed text-brand-muted">
            Enter your PAN and Aadhaar numbers, then attach one PAN file and Aadhaar front and back (JPG, PNG or PDF, up to 5MB each).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        <label
          className={cn(
            FORM_FIELD_CLASS,
            fieldErrors.panNumber ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS,
          )}
        >
          <span className={FORM_LABEL_CLASS}>PAN number</span>
          <input
            className={cn(FORM_INPUT_CLASS, isPanLocked && 'bg-[rgba(246,249,255,0.95)]')}
            type="text"
            name="panNumber"
            placeholder="ABCDE1234F"
            value={panNumber}
            onChange={handlePanChange}
            readOnly={isPanLocked}
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.panNumber)}
          />
          {fieldErrors.panNumber ? (
            <p className="m-0 text-[0.82rem] text-[#b2372d]">{fieldErrors.panNumber}</p>
          ) : null}
        </label>

        <label
          className={cn(
            FORM_FIELD_CLASS,
            fieldErrors.aadhaarNumber ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS,
          )}
        >
          <span className={FORM_LABEL_CLASS}>Aadhaar number</span>
          <input
            className={FORM_INPUT_CLASS}
            type="text"
            name="aadhaarNumber"
            placeholder="12 digits"
            value={aadhaarNumber}
            onChange={handleAadhaarChange}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.aadhaarNumber)}
          />
          {fieldErrors.aadhaarNumber ? (
            <p className="m-0 text-[0.82rem] text-[#b2372d]">{fieldErrors.aadhaarNumber}</p>
          ) : null}
        </label>

        <div
          className={cn(
            FORM_FIELD_CLASS,
            fieldErrors.panDocument ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS,
          )}
        >
          <span className={FORM_LABEL_CLASS}>PAN card file</span>
          <input
            id="panDocument"
            type="file"
            accept={ACCEPTED_FILES}
            className={FILE_INPUT_CLASS}
            onChange={handleFileChange('panDocument')}
            aria-invalid={Boolean(fieldErrors.panDocument)}
          />
          {panDocument ? (
            <span className="text-[0.82rem] text-brand-muted">{panDocument.name}</span>
          ) : null}
          {fieldErrors.panDocument ? (
            <p className="m-0 text-[0.82rem] text-[#b2372d]">{fieldErrors.panDocument}</p>
          ) : null}
        </div>

        <div
          className={cn(
            FORM_FIELD_CLASS,
            fieldErrors.aadhaarFront ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS,
          )}
        >
          <span className={FORM_LABEL_CLASS}>Aadhaar — front</span>
          <input
            id="aadhaarFront"
            type="file"
            accept={ACCEPTED_FILES}
            className={FILE_INPUT_CLASS}
            onChange={handleFileChange('aadhaarFront')}
            aria-invalid={Boolean(fieldErrors.aadhaarFront)}
          />
          {aadhaarFront ? (
            <span className="text-[0.82rem] text-brand-muted">{aadhaarFront.name}</span>
          ) : null}
          {fieldErrors.aadhaarFront ? (
            <p className="m-0 text-[0.82rem] text-[#b2372d]">{fieldErrors.aadhaarFront}</p>
          ) : null}
        </div>

        <div
          className={cn(
            FORM_FIELD_CLASS,
            fieldErrors.aadhaarBack ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS,
          )}
        >
          <span className={FORM_LABEL_CLASS}>Aadhaar — back</span>
          <input
            id="aadhaarBack"
            type="file"
            accept={ACCEPTED_FILES}
            className={FILE_INPUT_CLASS}
            onChange={handleFileChange('aadhaarBack')}
            aria-invalid={Boolean(fieldErrors.aadhaarBack)}
          />
          {aadhaarBack ? (
            <span className="text-[0.82rem] text-brand-muted">{aadhaarBack.name}</span>
          ) : null}
          {fieldErrors.aadhaarBack ? (
            <p className="m-0 text-[0.82rem] text-[#b2372d]">{fieldErrors.aadhaarBack}</p>
          ) : null}
        </div>

        {submitError ? <AlertBanner variant="error">{submitError}</AlertBanner> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button type="button" className="mc-btn-secondary" onClick={() => router.push('/kyc')}>
            Back
          </button>
          <button type="submit" className="mc-btn-primary min-w-[180px]" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Continue'}
          </button>
        </div>
        </form>
      </section>
    </CustomerJourneyGuard>
  );
}
