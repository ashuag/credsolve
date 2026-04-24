'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { saveKycDocuments } from '@/lib/api/lead';
import { cn } from '@/lib/cn';
import { isValidPan } from '@/lib/validators';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FILES = 'image/*,.pdf,application/pdf';
const AADHAAR_REGEX = /^\d{12}$/;

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
  const { session, refresh } = useCustomerSession();
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
      errors.panNumber = 'Invalid PAN.';
    }
    if (!AADHAAR_REGEX.test(normalizedAadhaar)) {
      errors.aadhaarNumber = '12-digit Aadhaar.';
    }

    const panFileError = validateFile(panDocument, 'PAN card');
    if (panFileError) errors.panDocument = panFileError;

    const aadhaarFrontError = validateFile(aadhaarFront, 'front');
    if (aadhaarFrontError) errors.aadhaarFront = aadhaarFrontError;

    const aadhaarBackError = validateFile(aadhaarBack, 'back');
    if (aadhaarBackError) errors.aadhaarBack = aadhaarBackError;

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
      if (refresh) await refresh();
      router.push('/bank-details');
    } catch (error) {
      setSubmitError(
        normalizeApiError(error instanceof Error ? error.message : '')
      );
      setIsSubmitting(false);
    }
  }

  const journeyPanel = (
    <div className="h-full flex flex-col justify-center">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
          </div>
          <span className="ml-3 text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">Step 5 — Verification</span>
        </div>

        <h1 className="text-2xl md:text-[2.2rem] font-extrabold text-brand-navy mb-4 tracking-tight leading-[1.1]">
          Identity Verification.
        </h1>
        <p className="text-[0.95rem] text-slate-500 mb-8 leading-relaxed">
          Upload clear copies of your original documents. This data is encrypted and only used for KYC compliance.
        </p>

        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <div>
            <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">PAN Number</label>
            <input
              className={cn(
                "w-full h-[52px] rounded-xl border px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all",
                fieldErrors.panNumber ? "border-red-300 bg-red-50" : "border-slate-200 bg-white",
                isPanLocked && "bg-slate-50 cursor-not-allowed opacity-70"
              )}
              type="text"
              placeholder="ABCDE1234F"
              value={panNumber}
              onChange={handlePanChange}
              readOnly={isPanLocked}
              autoComplete="off"
            />
            {fieldErrors.panNumber && <p className="mt-1 ml-1 text-[0.75rem] font-bold text-red-500">{fieldErrors.panNumber}</p>}
          </div>

          <div>
            <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Aadhaar Number</label>
            <input
              className={cn(
                "w-full h-[52px] rounded-xl border px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all",
                fieldErrors.aadhaarNumber ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
              )}
              type="text"
              placeholder="12 digits"
              value={aadhaarNumber}
              onChange={handleAadhaarChange}
              inputMode="numeric"
              autoComplete="off"
            />
            {fieldErrors.aadhaarNumber && <p className="mt-1 ml-1 text-[0.75rem] font-bold text-red-500">{fieldErrors.aadhaarNumber}</p>}
          </div>

          <div className="h-px bg-slate-100 my-2" />

          <div className="grid gap-3">
            <FileUploadField 
              label="PAN Card Image" 
              fileName={panDocument?.name} 
              onChange={handleFileChange('panDocument')} 
              error={fieldErrors.panDocument}
            />
            <div className="grid grid-cols-2 gap-3">
              <FileUploadField 
                label="Aadhaar Front" 
                fileName={aadhaarFront?.name} 
                onChange={handleFileChange('aadhaarFront')} 
                error={fieldErrors.aadhaarFront}
              />
              <FileUploadField 
                label="Aadhaar Back" 
                fileName={aadhaarBack?.name} 
                onChange={handleFileChange('aadhaarBack')} 
                error={fieldErrors.aadhaarBack}
              />
            </div>
          </div>

          {submitError ? <AlertBanner variant="error">{submitError}</AlertBanner> : null}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="mc-btn-primary flex-1 py-4 text-[1rem]"
            >
              {isSubmitting ? 'Verifying Documents...' : 'Complete Verification'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/loan-selection')}
              className="py-4 px-6 rounded-xl font-bold text-[1rem] text-slate-600 bg-white hover:bg-slate-50 transition-colors text-center border border-slate-200"
            >
              Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <CustomerJourneyGuard>
      <div className="min-h-screen bg-[linear-gradient(135deg,#f8faff,#e6f0ff)] flex items-center justify-center p-4 sm:p-6 md:p-8">
        <LoanLandingShell
          journeyPanel={journeyPanel}
          leftTitle={<>Bank Grade <span className="text-[#60a5fa]">Security</span></>}
          leftDescription="We use industry-standard encryption to protect your sensitive documents. Your data is 100% safe with us."
          leftInfographic={
            <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="kycGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
              </defs>
              <g transform="translate(100, 100)">
                <rect x="0" y="20" width="200" height="160" rx="20" fill="url(#kycGrad)" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                <path d="M60 20 V0 C60 -10 70 -20 80 -20 H120 C130 -20 140 -10 140 0 V20" stroke="#facc15" strokeWidth="12" fill="none" strokeLinecap="round" />
                <circle cx="100" cy="100" r="30" fill="rgba(255,255,255,0.15)" />
                <rect x="92" y="90" width="16" height="20" rx="4" fill="#facc15" />
                <path d="M100 110 V125" stroke="#facc15" strokeWidth="6" strokeLinecap="round" />
              </g>
            </svg>
          }
        />
      </div>
    </CustomerJourneyGuard>
  );
}

function FileUploadField({ label, fileName, onChange, error }: { label: string; fileName?: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void; error?: string }) {
  return (
    <div>
      <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{label}</label>
      <div className={cn(
        "relative rounded-xl border border-dashed transition-all p-3",
        error ? "border-red-300 bg-red-50" : fileName ? "border-green-300 bg-green-50" : "border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400"
      )}>
        <input
          type="file"
          accept={ACCEPTED_FILES}
          onChange={onChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            error ? "bg-red-100 text-red-600" : fileName ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
          )}>
            {fileName ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <div className={cn("text-[0.85rem] font-bold truncate", fileName ? "text-green-700" : "text-slate-700")}>
              {fileName || "Select File"}
            </div>
            <div className="text-[0.7rem] text-slate-400">PDF, JPG, PNG (Max 5MB)</div>
          </div>
        </div>
      </div>
      {error && <p className="mt-1 ml-1 text-[0.75rem] font-bold text-red-500">{error}</p>}
    </div>
  );
}
