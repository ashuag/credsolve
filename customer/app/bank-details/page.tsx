'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getLoanBanks, saveBankDetails } from '@/lib/api/lead';

export default function BankDetailsPage() {
  const router = useRouter();
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [banks, setBanks] = useState<string[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const account = accountNumber.replace(/\D/g, '');
    const ifsc = ifscCode.trim().toUpperCase();
    const bank = bankName.trim();
    if (!banks.includes(bank)) {
      setError('Please select a valid bank from the list.');
      return;
    }
    if (!/^\d{9,18}$/.test(account)) {
      setError('Please enter a valid bank account number.');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setError('Please enter a valid IFSC code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveBankDetails({
        accountNumber: account,
        ifscCode: ifsc,
        bankName: bank,
        accountHolderName: accountHolderName.trim() || undefined,
      });
      router.replace('/thank-you');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save bank details right now.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mc-card grid gap-5 max-w-2xl">
      <div className="mc-chip">Bank details</div>
      <h1 className="m-0 text-brand-navy text-[clamp(1.9rem,5vw,2.8rem)] tracking-[-0.05em] leading-[1.08]">
        Add your bank details.
      </h1>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-[0.88rem] font-bold text-brand-navy">Account holder name</span>
          <input
            className="w-full min-h-[52px] px-4 rounded-[16px] border border-[rgba(18,36,79,0.16)] bg-white text-brand-navy font-bold"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            placeholder="As per bank records"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[0.88rem] font-bold text-brand-navy">Bank name</span>
          <select
            className="w-full min-h-[52px] px-4 rounded-[16px] border border-[rgba(18,36,79,0.16)] bg-white text-brand-navy font-bold"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            required
            disabled={isLoadingBanks}
          >
            <option value="">{isLoadingBanks ? 'Loading banks...' : 'Select your bank'}</option>
            {banks.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-[0.88rem] font-bold text-brand-navy">Account number</span>
          <input
            className="w-full min-h-[52px] px-4 rounded-[16px] border border-[rgba(18,36,79,0.16)] bg-white text-brand-navy font-bold"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
            placeholder="9-18 digit account number"
            inputMode="numeric"
            required
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[0.88rem] font-bold text-brand-navy">IFSC code</span>
          <input
            className="w-full min-h-[52px] px-4 rounded-[16px] border border-[rgba(18,36,79,0.16)] bg-white text-brand-navy font-bold uppercase"
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            placeholder="ABCD0123456"
            required
          />
        </label>

        {error ? <p className="m-0 text-[#b2372d] text-[0.9rem]">{error}</p> : null}

        <div className="flex gap-3 flex-wrap">
          <button type="submit" className="mc-btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Submit'}
          </button>
          <button type="button" className="mc-btn-secondary" onClick={() => router.push('/kyc')}>
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

