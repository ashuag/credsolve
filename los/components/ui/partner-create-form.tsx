'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/los';

const initialState = {
  companyName: '',
  email: '',
  phoneNumber: '',
  businessAddress: '',
  partnerType: 'Company',
  internalNotes: ''
};

export function PartnerCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/partners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.message ?? 'Failed to create partner.');
        setLoading(false);
        return;
      }

      setForm(initialState);
      setMessage('Partner added successfully.');
      router.refresh();
    } catch {
      setMessage('Unable to reach the backend.');
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = 'grid gap-2';
  const labelClass = 'text-[0.92rem] font-bold text-brand-text';

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className={fieldClass}>
        <label htmlFor="companyName" className={labelClass}>Company name</label>
        <input
          id="companyName"
          className="los-input"
          value={form.companyName}
          onChange={(event) => setForm({ ...form, companyName: event.target.value })}
          required
        />
      </div>
      <div className={fieldClass}>
        <label htmlFor="partnerEmail" className={labelClass}>Email</label>
        <input
          id="partnerEmail"
          className="los-input"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
      </div>
      <div className={fieldClass}>
        <label htmlFor="partnerPhone" className={labelClass}>Phone</label>
        <input
          id="partnerPhone"
          className="los-input"
          value={form.phoneNumber}
          onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
          required
        />
      </div>
      <div className={fieldClass}>
        <label htmlFor="partnerAddress" className={labelClass}>Business address</label>
        <input
          id="partnerAddress"
          className="los-input"
          value={form.businessAddress}
          onChange={(event) => setForm({ ...form, businessAddress: event.target.value })}
          required
        />
      </div>
      <div className={fieldClass}>
        <label htmlFor="partnerType" className={labelClass}>Partner type</label>
        <select
          id="partnerType"
          className="los-input"
          value={form.partnerType}
          onChange={(event) => setForm({ ...form, partnerType: event.target.value })}
        >
          <option>Company</option>
          <option>Individual</option>
        </select>
      </div>
      <div className={fieldClass}>
        <label htmlFor="partnerNotes" className={labelClass}>Internal notes</label>
        <textarea
          id="partnerNotes"
          className="los-input min-h-[112px] resize-y"
          value={form.internalNotes}
          onChange={(event) => setForm({ ...form, internalNotes: event.target.value })}
        />
      </div>
      {message ? (
        <div className="rounded-[18px] p-[14px_16px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] text-[#8d3434] text-[0.92rem]">
          {message}
        </div>
      ) : null}
      <button className="los-btn-primary" type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Add Partner'}
      </button>
    </form>
  );
}
