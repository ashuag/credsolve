'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { getLoanBanks, saveBankDetails } from '@/lib/api/lead';
import { sendCustomerOtp, verifyCustomerOtp } from '@/lib/api/auth';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { cn } from '@/lib/cn';

export default function BankDetailsPage() {
  const router = useRouter();
  const { session } = useCustomerSession();
  
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [banks, setBanks] = useState<string[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // OTP State
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpRequestId, setOtpRequestId] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;
    getLoanBanks()
      .then((items) => {
        if (!mounted) return;
        setBanks(items);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Unable to load banks right now.');
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoadingBanks(false);
      });

    return () => {
      mounted = false;
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, []);

  const handleInitialSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!bankName) {
      setError('Please select your bank.');
      return;
    }
    if (!/^\d{9,18}$/.test(accountNumber.replace(/\D/g, ''))) {
      setError('Please enter a valid bank account number.');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.trim().toUpperCase())) {
      setError('Please enter a valid IFSC code.');
      return;
    }

    if (!session?.authenticated) return;

    setIsSubmitting(true);
    try {
      const res = await sendCustomerOtp(session.mobileNumber);
      setOtpRequestId(res.requestId);
      const expires = new Date(res.expiresAt).getTime();
      setOtpExpiresAt(expires);
      setShowOtpStep(true);

      // Handle expiry redirect
      const timeout = expires - Date.now();
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = setTimeout(() => {
        router.push('/apply-for-loan');
      }, timeout);

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAndComplete = async () => {
    if (!otpValue || otpValue.length < 4) {
      setError('Please enter a valid OTP.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const verifyRes = await verifyCustomerOtp(otpRequestId, otpValue);
      if (!verifyRes.verified) {
        throw new Error('Invalid OTP code.');
      }

      await saveBankDetails({
        accountNumber: accountNumber.replace(/\D/g, ''),
        ifscCode: ifscCode.trim().toUpperCase(),
        bankName: bankName.trim(),
        accountHolderName: accountHolderName.trim() || undefined,
      });
      
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      router.replace('/thank-you');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
      setIsSubmitting(false);
    }
  };

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

        {!showOtpStep ? (
          <>
            <h1 className="text-2xl md:text-[2.2rem] font-extrabold text-brand-navy mb-4 tracking-tight leading-[1.1]">
              Receive Money.
            </h1>
            <p className="text-[0.95rem] text-slate-500 mb-8 leading-relaxed">
              Provide your bank details where you want the loan amount to be credited. Money is usually disbursed within 15 minutes of approval.
            </p>

            <form onSubmit={handleInitialSubmit} className="grid gap-4" noValidate>
              <div>
                <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Account Holder Name</label>
                <input
                  className="w-full h-[52px] rounded-xl border border-slate-200 bg-white px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
                  type="text"
                  placeholder="As per bank records"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Bank Name</label>
                <div className="relative">
                  <select
                    className="w-full h-[52px] rounded-xl border border-slate-200 bg-white px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 focus:ring-brand-blue/20 outline-none appearance-none transition-all"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={isLoadingBanks}
                  >
                    <option value="">{isLoadingBanks ? 'Loading banks...' : 'Select your bank'}</option>
                    {banks.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Account Number</label>
                  <input
                    className="w-full h-[52px] rounded-xl border border-slate-200 bg-white px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
                    type="text"
                    placeholder="9-18 digit number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">IFSC Code</label>
                  <input
                    className="w-full h-[52px] rounded-xl border border-slate-200 bg-white px-4 text-[0.95rem] font-bold text-brand-navy focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all uppercase"
                    type="text"
                    placeholder="ABCD0123456"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              {error ? (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-[0.85rem] font-bold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mc-btn-primary flex-1 py-4 text-[1rem]"
                >
                  {isSubmitting ? 'Processing...' : 'Submit & Disburse'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/kyc/upload-documents')}
                  className="py-4 px-6 rounded-xl font-bold text-[1rem] text-slate-600 bg-white hover:bg-slate-50 transition-colors text-center border border-slate-200"
                >
                  Back
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl md:text-[2.2rem] font-extrabold text-brand-navy mb-4 tracking-tight leading-[1.1]">
              Verify Security Code.
            </h1>
            <p className="text-[0.95rem] text-slate-500 mb-8 leading-relaxed">
              We've sent a 6-digit security code to{' '}
              <span className="font-bold text-brand-navy">
                {session?.authenticated ? session.mobileNumber : 'your registered mobile'}
              </span>
              . Please enter it to authorize the disbursement.
            </p>

            <div className="grid gap-4">
              <div>
                <label className="block text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">OTP Code</label>
                <input
                  className="w-full h-[60px] rounded-2xl border border-slate-200 bg-white px-4 text-center text-2xl font-black tracking-[0.5em] text-brand-navy focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all placeholder:text-slate-200"
                  type="text"
                  placeholder="000000"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                />
              </div>

              {error ? (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-[0.85rem] font-bold">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={handleVerifyAndComplete}
                  disabled={isSubmitting}
                  className="mc-btn-primary py-4 text-[1rem]"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify & Confirm Payout'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOtpStep(false)}
                  className="text-center py-2 text-[0.9rem] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Change Bank Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <CustomerJourneyGuard>
      <div className="min-h-screen bg-[linear-gradient(135deg,#f8faff,#e6f0ff)] flex items-center justify-center p-4 sm:p-6 md:p-8">
        <LoanLandingShell
          journeyPanel={journeyPanel}
          leftTitle={<>Instant <span className="text-[#60a5fa]">Disbursement</span></>}
          leftDescription={showOtpStep ? "Final step! Verify your identity to receive your funds immediately." : "Direct transfer to your bank account within minutes of approval. 24/7 processing."}
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
                <text x="220" y="50" textAnchor="middle" fill="white" fontSize="30" fontWeight="bold">₹</text>
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



