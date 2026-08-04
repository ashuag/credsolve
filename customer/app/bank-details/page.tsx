'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { lookupBankIfsc, submitVerifiedBankDetails } from '@/lib/api/lead';
import { IFSC_CODE_LENGTH, getIfscValidationError, isValidIfscCode, normalizeIfscInput } from '@/lib/ifsc';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';

const DETAIL_LABELS: Record<string, string> = {
  bankName: 'Bank name',
  ifsc: 'IFSC',
  branch: 'Branch',
  address: 'Address',
  city: 'City',
  district: 'District',
  state: 'State',
  centre: 'Centre',
  micr: 'MICR',
  contact: 'Contact',
  bankCode: 'Bank code',
  iso3166: 'Region',
  rtgsAvailable: 'RTGS',
  neftAvailable: 'NEFT',
  impsAvailable: 'IMPS',
  upiAvailable: 'UPI',
  swift: 'SWIFT',
};

function formatCell(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v).trim();
  return s.length ? s : null;
}

function IfscDetailPanel({ details }: { details: Record<string, unknown> }) {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  const orderedKeys = [
    ...Object.keys(DETAIL_LABELS),
    ...Object.keys(details).filter((k) => !DETAIL_LABELS[k] && k !== 'vendorResponse'),
  ];
  const seen = new Set<string>();
  for (const k of orderedKeys) {
    if (seen.has(k)) continue;
    const val = formatCell(details[k]);
    if (!val) continue;
    seen.add(k);
    const label =
      DETAIL_LABELS[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    rows.push({ key: k, label, value: val });
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
      <p className="m-0 mb-3 text-[0.7rem] font-black text-slate-500 uppercase tracking-wider">IFSC details</p>
      <dl className="grid gap-2 text-sm max-h-[280px] overflow-y-auto pr-1">
        {rows.slice(0, 18).map((row) => (
          <div key={row.key} className="grid grid-cols-[minmax(0,0.42fr)_1fr] gap-2">
            <dt className="text-brand-muted font-medium">{row.label}</dt>
            <dd className="m-0 text-brand-navy font-semibold break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function BankDetailsPage() {
  const router = useRouter();
  const { session, refresh } = useCustomerSession();

  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [ifscTouched, setIfscTouched] = useState(false);

  const [ifscLookup, setIfscLookup] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [ifscDetails, setIfscDetails] = useState<Record<string, unknown> | null>(null);
  const [ifscLookupNote, setIfscLookupNote] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verificationProgress, setVerificationProgress] = useState<{
    attemptsUsed: number;
    attemptsAllowed: number;
    retryLimitReached: boolean;
  } | null>(null);

  const accountHolderDisplay =
    session?.authenticated === true ? (session.profile?.fullName?.trim() ?? '') : '';

  const normalizedAccount = accountNumber.replace(/\D/g, '');
  const normalizedConfirmAccount = confirmAccountNumber.replace(/\D/g, '');
  const accountsMatch =
    normalizedAccount.length >= 9 &&
    normalizedConfirmAccount.length >= 9 &&
    normalizedAccount === normalizedConfirmAccount;
  const accountMismatch =
    normalizedConfirmAccount.length >= 9 && normalizedAccount !== normalizedConfirmAccount;

  useEffect(() => {
    if (session?.authenticated !== true) return;
    setVerificationProgress(session.bankVerificationProgress ?? null);
  }, [session]);

  const retryLimitReached = verificationProgress?.retryLimitReached === true;
  const attemptsRemaining = verificationProgress
    ? Math.max(0, verificationProgress.attemptsAllowed - verificationProgress.attemptsUsed)
    : null;

  const normalizedIfsc = ifscCode.trim().toUpperCase();
  const ifscValidationError = getIfscValidationError(ifscCode, {
    touched: ifscTouched || normalizedIfsc.length === IFSC_CODE_LENGTH,
  });

  useEffect(() => {
    if (!isValidIfscCode(normalizedIfsc)) {
      setIfscLookup('idle');
      setIfscDetails(null);
      setIfscLookupNote('');
      return;
    }

    let cancelled = false;
    setIfscLookup('loading');
    setIfscLookupNote('');
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const out = await lookupBankIfsc(normalizedIfsc);
          if (cancelled) return;
          if (!out) {
            setIfscLookup('error');
            setIfscDetails(null);
            setIfscLookupNote('No response from IFSC lookup.');
            return;
          }
          if (!out.configured) {
            setIfscLookup('error');
            setIfscDetails(null);
            setIfscLookupNote(out.skipReason ?? 'IFSC lookup is not configured.');
            return;
          }
          if (!out.ok || !out.details || Object.keys(out.details).length === 0) {
            setIfscLookup('error');
            setIfscDetails(null);
            setIfscLookupNote('Could not resolve this IFSC. Check the code and try again.');
            return;
          }
          setIfscDetails(out.details);
          setIfscLookup('ok');
        } catch (e) {
          if (cancelled) return;
          setIfscLookup('error');
          setIfscDetails(null);
          setIfscLookupNote(e instanceof Error ? e.message : 'IFSC lookup failed.');
        }
      })();
    }, 480);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [normalizedIfsc]);

  const ifscFieldMessage = ifscValidationError ?? (ifscLookup === 'error' ? ifscLookupNote : null);
  const ifscFieldMessageIsError = Boolean(ifscValidationError || ifscLookup === 'error');

  const canSubmit =
    !retryLimitReached &&
    accountHolderDisplay.length >= 2 &&
    accountsMatch &&
    /^\d{9,18}$/.test(normalizedAccount) &&
    isValidIfscCode(normalizedIfsc) &&
    ifscLookup === 'ok' &&
    ifscDetails !== null;

  function openConfirm() {
    setError('');
    setIfscTouched(true);
    if (ifscValidationError) {
      setError(ifscValidationError);
      return;
    }
    if (!canSubmit) {
      if (ifscLookup === 'loading') {
        setError('Please wait while we fetch branch details for your IFSC.');
        return;
      }
      if (ifscLookup === 'error' && ifscLookupNote) {
        setError(ifscLookupNote);
        return;
      }
      setError('Enter a valid account number and confirmation, wait for branch details to load, and ensure your name is on file.');
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmAndVerify() {
    setBusy(true);
    setError('');
    try {
      const bankName =
        ifscDetails && typeof ifscDetails.bankName === 'string' ? ifscDetails.bankName.trim() : undefined;
      const res = await submitVerifiedBankDetails({
        accountNumber: normalizedAccount,
        confirmAccountNumber: normalizedConfirmAccount,
        ifscCode: ifscCode.trim().toUpperCase(),
        verifiedBankName: bankName,
      });
      if (!res) {
        setConfirmOpen(false);
        setError('Empty response from bank verification.');
        return;
      }
      setVerificationProgress({
        attemptsUsed: res.attemptsUsed,
        attemptsAllowed: res.attemptsAllowed,
        retryLimitReached: res.retryLimitReached,
      });
      if (!res.success || !res.pennyDropOk) {
        // Close confirm so the form shows the mismatch / failure message.
        setConfirmOpen(false);
        setError(res.message ?? 'Bank verification did not succeed. Please check your details.');
        return;
      }
      setConfirmOpen(false);
      await refresh();
      router.replace('/references');
    } catch (e) {
      setConfirmOpen(false);
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  const journeyPanel = (
    <div className="h-full flex flex-col justify-center">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-2 w-8 rounded-full bg-blue-600"></div>
            ))}
          </div>
          <span className="ml-3 text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">Step 6 — Disbursement</span>
        </div>

        <h1 className="text-2xl md:text-[2.2rem] font-extrabold text-brand-navy mb-4 tracking-tight leading-[1.1]">
          Receive Money.
        </h1>
        <p className="text-[0.95rem] text-slate-500 mb-8 leading-relaxed">
          Enter your IFSC — we fetch branch details for you to review. When you submit, we verify your account (penny
          drop) and mark your application for review.
        </p>

        <div className="grid gap-4">
          <div>
            <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Account holder name
            </label>
            <input
              className="w-full h-[52px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-[0.95rem] font-bold text-brand-navy outline-none cursor-default"
              type="text"
              readOnly
              aria-readonly="true"
              value={accountHolderDisplay}
              placeholder="From your application — complete personal details if empty"
            />
            <p className="mt-1.5 ml-1 text-[0.75rem] text-slate-500 leading-snug">
              Used for penny-drop verification; must match your bank records.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                Account number
              </label>
              <input
                className="w-full h-[52px] rounded-xl border border-slate-200 bg-white px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all tracking-widest"
                type="password"
                placeholder="9-18 digit number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                inputMode="numeric"
                autoComplete="off"
                disabled={retryLimitReached}
              />
            </div>
            <div>
              <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                Confirm account number
              </label>
              <input
                className={[
                  'w-full h-[52px] rounded-xl border bg-white px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 outline-none transition-all',
                  accountMismatch
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-slate-200 focus:ring-brand-blue/20',
                ].join(' ')}
                type="text"
                placeholder="Re-enter account number"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                inputMode="numeric"
                disabled={retryLimitReached}
              />
              {accountMismatch ? (
                <p className="mt-1.5 ml-1 text-[0.75rem] font-semibold text-red-600">
                  Account numbers do not match.
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
              IFSC code
            </label>
            <input
              className={[
                'w-full h-[52px] rounded-xl border bg-white px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 outline-none transition-all uppercase',
                ifscFieldMessageIsError
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-slate-200 focus:ring-brand-blue/20',
              ].join(' ')}
              type="text"
              placeholder="HDFC0001234"
              value={ifscCode}
              maxLength={IFSC_CODE_LENGTH}
              onChange={(e) => {
                setIfscTouched(false);
                setIfscCode(normalizeIfscInput(e.target.value));
              }}
              onBlur={() => setIfscTouched(true)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={ifscFieldMessageIsError}
              aria-describedby="ifsc-field-help"
              disabled={retryLimitReached}
            />
            {ifscLookup === 'loading' ? (
              <p className="mt-1.5 ml-1 text-[0.75rem] text-slate-500">Looking up IFSC…</p>
            ) : null}
            {ifscFieldMessage ? (
              <p
                className={[
                  'mt-1.5 ml-1 text-[0.75rem] font-semibold',
                  ifscFieldMessageIsError ? 'text-red-600' : 'text-slate-500',
                ].join(' ')}
              >
                {ifscFieldMessage}
              </p>
            ) : null}
            {ifscLookup === 'ok' && ifscDetails ? (
              <p className="mt-1.5 ml-1 text-[0.75rem] font-semibold text-emerald-600">IFSC verified — branch details loaded.</p>
            ) : null}
          </div>

          {ifscLookup === 'ok' && ifscDetails ? <IfscDetailPanel details={ifscDetails} /> : null}

          {attemptsRemaining !== null && !retryLimitReached ? (
            <p className="m-0 text-[0.8rem] text-slate-500">
              Bank verification attempts remaining: <strong>{attemptsRemaining}</strong> of{' '}
              {verificationProgress?.attemptsAllowed ?? attemptsRemaining}
            </p>
          ) : null}

          {retryLimitReached ? (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-900 text-[0.85rem] font-semibold leading-relaxed">
              You have used all bank verification attempts. Please contact support — you cannot proceed until your
              account is verified.
            </div>
          ) : null}

          {error ? (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-[0.85rem] font-bold">
              {error}
            </div>
          ) : null}

          <div className="mt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={busy || !canSubmit}
              onClick={() => openConfirm()}
              className="mc-btn-primary flex-1 py-4 text-[1rem] disabled:opacity-50"
            >
              Submit details
            </button>
            <button
              type="button"
              onClick={() => router.push('/kyc')}
              className="py-4 px-6 rounded-xl font-bold text-[1rem] text-slate-600 bg-white hover:bg-slate-50 transition-colors text-center border border-slate-200"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bank-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 grid gap-4">
            <h2 id="bank-confirm-title" className="m-0 text-lg font-black text-brand-navy">
              Confirm details
            </h2>
            <p className="m-0 text-sm text-slate-600 leading-relaxed">
              Please confirm the bank account and IFSC details below are correct. We will run a one-paise verification
              with your bank using the account holder name on file.
            </p>
            <ul className="m-0 pl-4 text-sm text-brand-navy space-y-1.5 list-disc">
              <li>
                <span className="font-semibold">Account holder:</span> {accountHolderDisplay || '—'}
              </li>
              <li>
                <span className="font-semibold">Account number:</span> {normalizedAccount || '—'}
              </li>
              <li>
                <span className="font-semibold">IFSC:</span> {ifscCode.trim().toUpperCase() || '—'}
              </li>
              {ifscDetails && formatCell(ifscDetails.bankName) ? (
                <li>
                  <span className="font-semibold">Bank:</span> {String(ifscDetails.bankName)}
                </li>
              ) : null}
              {ifscDetails && formatCell(ifscDetails.branch) ? (
                <li>
                  <span className="font-semibold">Branch:</span> {String(ifscDetails.branch)}
                </li>
              ) : null}
            </ul>
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                className="py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                No, go back
              </button>
              <button
                type="button"
                className="mc-btn-primary flex-1 py-3"
                disabled={busy}
                onClick={() => void confirmAndVerify()}
              >
                {busy ? 'Verifying…' : 'Yes, verify & submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <CustomerJourneyGuard>
      <div className="min-h-screen bg-[linear-gradient(135deg,#f8faff,#e6f0ff)] flex items-center justify-center p-4 sm:p-6 md:p-8">
        <LoanLandingShell
          journeyPanel={journeyPanel}
          leftTitle={<>Instant <span className="text-[#60a5fa]">Disbursement</span></>}
          leftDescription="We verify your account securely before crediting your loan. Review IFSC details, then confirm to submit your application for review."
          leftInfographic={
            <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="moneyGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              <g transform="translate(100, 120)">
                <path d="M0 120 H200 V140 H0 Z" fill="#1e3a8a" />
                <path d="M20 120 V50 H180 V120" fill="#1e40af" />
                <path d="M10 50 L100 0 L190 50 Z" fill="#1e3a8a" />
                <rect x="40" y="70" width="20" height="30" fill="rgba(255,255,255,0.2)" />
                <rect x="90" y="70" width="20" height="30" fill="rgba(255,255,255,0.2)" />
                <rect x="140" y="70" width="20" height="30" fill="rgba(255,255,255,0.2)" />
                <circle cx="220" cy="40" r="30" fill="url(#moneyGrad)" className="animate-bounce" />
                <text x="220" y="50" textAnchor="middle" fill="white" fontSize="30" fontWeight="bold">
                  ₹
                </text>
                <path d="M180 40 Q250 40 250 100" stroke="#facc15" strokeWidth="6" strokeDasharray="10,5" fill="none" />
                <path d="M245 95 L250 105 L255 95" fill="#facc15" />
              </g>
            </svg>
          }
        />
      </div>
    </CustomerJourneyGuard>
  );
}
