'use client';

import { type FormEvent, useState } from 'react';
import { submitContactMessage } from '@/lib/api';
import { ApiRequestError } from '@/lib/api/client';
import { isValidCustomerMobile, normalizeCustomerMobile } from '@/lib/mobile';
import { isValidEmail } from '@/lib/validators';
import {
  FORM_FIELD_CLASS,
  FORM_FIELD_ERROR_CLASS,
  FORM_FIELD_NORMAL_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
} from '@/lib/form-styles';
import { cn } from '@/lib/cn';

const CONTACT_EMAIL = 'contact@moneycash.in';
const CONTACT_ADDRESS =
  'E-2748 Gaur Siddhartham, Siddharth Vihar, Ghaziabad City, Ghaziabad, Ghaziabad- 201009, Uttar Pradesh';
const CONTACT_MAP_LINK = 'https://maps.app.goo.gl/1cc4TMr1Wm6SEq6g8';
const CONTACT_MAP_EMBED = `https://www.google.com/maps?q=${encodeURIComponent(CONTACT_ADDRESS)}&output=embed`;

type FormState = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = { name: '', email: '', phone: '', subject: '', message: '' };

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = 'Please enter your name.';
  if (!form.email.trim()) errors.email = 'Please enter your email.';
  else if (!isValidEmail(form.email)) errors.email = 'Please enter a valid email address.';
  if (!form.phone.trim()) errors.phone = 'Please enter your phone number.';
  else if (!isValidCustomerMobile(form.phone)) {
    errors.phone = 'Please enter a valid 10-digit mobile number.';
  }
  if (!form.subject.trim()) errors.subject = 'Please enter a subject.';
  if (form.message.trim().length < 5) errors.message = 'Please enter a message (at least 5 characters).';
  return errors;
}

export function ContactUsView() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      await submitContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: normalizeCustomerMobile(form.phone),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
      setForm(EMPTY_FORM);
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : 'Unable to send your message right now. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,150,243,0.2)] bg-white px-4 py-1.5 text-[0.72rem] font-[900] uppercase tracking-[0.18em] text-brand-blue shadow-sm">
          Contact Us
        </span>
        <h1 className="mt-5 text-3xl font-[900] leading-tight text-brand-navy sm:text-4xl">
          We&rsquo;d love to hear from you
        </h1>
        <p className="mt-3 text-base font-[500] leading-relaxed text-brand-muted">
          Have a question about your loan, a payment, or anything else? Reach out and our team will get
          back to you as soon as possible.
        </p>
      </header>

      <div className="mt-12 grid gap-6 lg:grid-cols-5">
        {/* Contact info */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="group flex items-start gap-4 rounded-[20px] border border-[rgba(18,36,79,0.08)] bg-white p-5 shadow-[0_12px_24px_rgba(23,44,113,0.05)] transition-all hover:-translate-y-0.5 hover:border-[rgba(20,150,243,0.28)] hover:shadow-[0_18px_36px_rgba(23,44,113,0.1)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(20,150,243,0.1)] text-brand-blue transition-colors group-hover:bg-brand-blue group-hover:text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-[0.68rem] font-[900] uppercase tracking-[0.16em] text-brand-muted">Email</div>
              <div className="mt-1 break-words text-base font-[800] text-brand-navy">{CONTACT_EMAIL}</div>
            </div>
          </a>

          <a
            href={CONTACT_MAP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-[20px] border border-[rgba(18,36,79,0.08)] bg-white p-5 shadow-[0_12px_24px_rgba(23,44,113,0.05)] transition-all hover:-translate-y-0.5 hover:border-[rgba(244,180,0,0.35)] hover:shadow-[0_18px_36px_rgba(23,44,113,0.1)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(244,180,0,0.14)] text-[#c98a00]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-[0.68rem] font-[900] uppercase tracking-[0.16em] text-brand-muted">Registered Address</div>
              <address className="mt-1 text-[0.95rem] font-[700] not-italic leading-relaxed text-brand-navy">
                {CONTACT_ADDRESS}
              </address>
            </div>
          </a>

          <div className="overflow-hidden rounded-[20px] border border-[rgba(18,36,79,0.08)] bg-white shadow-[0_12px_24px_rgba(23,44,113,0.05)]">
            <iframe
              title="MoneyCash office location on Google Maps"
              src={CONTACT_MAP_EMBED}
              className="h-[260px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>

        {/* Contact form */}
        <div className="rounded-[24px] border border-[rgba(18,36,79,0.08)] bg-white p-6 shadow-[0_20px_44px_rgba(23,44,113,0.08)] sm:p-8 lg:col-span-3">
          {submitted ? (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)] text-[#16a34a]">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="text-xl font-[900] text-brand-navy">Message sent!</h2>
              <p className="max-w-md text-sm font-[500] leading-relaxed text-brand-muted">
                Thanks for reaching out. Our team has received your message and will get back to you at your
                email shortly.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-2 rounded-2xl bg-brand-blue px-6 py-3 text-sm font-[800] text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,150,243,0.35)]"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
              <label className={cn(FORM_FIELD_CLASS, errors.name ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
                <span className={FORM_LABEL_CLASS}>Name</span>
                <input
                  className={cn(FORM_INPUT_CLASS, 'uppercase placeholder:normal-case')}
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value.toUpperCase())}
                  placeholder="Your full name"
                  maxLength={150}
                  autoComplete="name"
                />
                {errors.name ? <span className="text-[0.8rem] font-[600] text-[#c1392b]">{errors.name}</span> : null}
              </label>

              <label className={cn(FORM_FIELD_CLASS, errors.email ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
                <span className={FORM_LABEL_CLASS}>Email ID</span>
                <input
                  className={FORM_INPUT_CLASS}
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="you@example.com"
                  maxLength={190}
                  autoComplete="email"
                />
                {errors.email ? <span className="text-[0.8rem] font-[600] text-[#c1392b]">{errors.email}</span> : null}
              </label>

              <label className={cn(FORM_FIELD_CLASS, errors.phone ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
                <span className={FORM_LABEL_CLASS}>Phone number</span>
                <div
                  className={cn(
                    FORM_INPUT_CLASS,
                    'grid items-center gap-0 p-0 focus-within:border-[rgba(20,150,243,0.45)]',
                  )}
                  style={{ gridTemplateColumns: '72px 1fr' }}
                >
                  <span className="inline-flex h-full items-center justify-center border-r border-[rgba(18,36,79,0.1)] text-[1.05rem] font-[800] text-brand-navy">
                    +91
                  </span>
                  <input
                    className="h-full w-full border-0 bg-transparent px-4 py-[14px] text-brand-navy caret-brand-blue outline-none placeholder:text-[rgba(94,103,130,0.86)]"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => updateField('phone', normalizeCustomerMobile(e.target.value))}
                    placeholder="9876543210"
                    maxLength={10}
                    autoComplete="tel-national"
                  />
                </div>
                {errors.phone ? <span className="text-[0.8rem] font-[600] text-[#c1392b]">{errors.phone}</span> : null}
              </label>

              <label className={cn(FORM_FIELD_CLASS, errors.subject ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
                <span className={FORM_LABEL_CLASS}>Subject</span>
                <input
                  className={FORM_INPUT_CLASS}
                  type="text"
                  value={form.subject}
                  onChange={(e) => updateField('subject', e.target.value)}
                  placeholder="How can we help?"
                  maxLength={200}
                />
                {errors.subject ? <span className="text-[0.8rem] font-[600] text-[#c1392b]">{errors.subject}</span> : null}
              </label>

              <label className={cn(FORM_FIELD_CLASS, errors.message ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
                <span className={FORM_LABEL_CLASS}>Message</span>
                <textarea
                  className={cn(FORM_INPUT_CLASS, 'min-h-[140px] resize-y')}
                  value={form.message}
                  onChange={(e) => updateField('message', e.target.value)}
                  placeholder="Write your message here..."
                  maxLength={5000}
                />
                {errors.message ? <span className="text-[0.8rem] font-[600] text-[#c1392b]">{errors.message}</span> : null}
              </label>

              {submitError ? (
                <div className="rounded-2xl border border-[rgba(193,57,43,0.28)] bg-[rgba(255,241,241,0.9)] px-4 py-3 text-sm font-[600] text-[#8d3434]">
                  {submitError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-blue px-8 py-4 text-sm font-[900] text-white shadow-[0_12px_28px_rgba(20,150,243,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(20,150,243,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
