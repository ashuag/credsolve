import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { OnChange } from './_types';

export const secondaryBtn =
  'py-3 px-4 rounded-xl font-bold text-[0.95rem] text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-center border border-slate-200';

export function inputCls(err: boolean) {
  return cn(
    'mc-autofill-fix w-full h-[48px] rounded-xl border px-3 bg-white text-slate-900 text-[0.95rem] font-semibold outline-none transition-all',
    'placeholder:text-slate-400 placeholder:font-normal focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm',
    err ? 'border-red-400 focus:ring-red-500/10' : 'border-slate-200',
  );
}

type FormInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'name' | 'className' | 'aria-invalid' | 'aria-describedby'
> & { id: string; label: string; error?: string; span2?: boolean; labelSentenceCase?: boolean; className?: string };

export function FormInput({ id, label, error, span2, labelSentenceCase, className, ...rest }: FormInputProps) {
  const hasErr = Boolean(error);
  const inner = (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        htmlFor={id}
        className={
          labelSentenceCase
            ? 'text-[0.75rem] font-bold text-slate-600 tracking-normal pl-1 leading-snug'
            : 'text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1'
        }
      >
        {label}
      </label>
      <input
        id={id} name={id}
        aria-invalid={hasErr}
        aria-describedby={hasErr ? `${id}-error` : undefined}
        className={cn(inputCls(hasErr), className)}
        {...rest}
      />
      {error && <p id={`${id}-error`} className="text-[#b2372d] text-[0.75rem] pl-1 font-medium m-0">{error}</p>}
    </div>
  );
  return span2 ? <div className="md:col-span-2">{inner}</div> : inner;
}

type FormSelectProps = {
  id: string; label: string; error?: string; span2?: boolean;
  value: string; onChange: ReturnType<OnChange>; disabled?: boolean; children: ReactNode;
};

export function FormSelect({ id, label, error, span2, value, onChange, disabled, children }: FormSelectProps) {
  const hasErr = Boolean(error);
  const inner = (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={id} className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1">{label}</label>
      <select
        id={id} name={id} value={value} onChange={onChange} disabled={disabled}
        aria-invalid={hasErr}
        aria-describedby={hasErr ? `${id}-error` : undefined}
        className={inputCls(hasErr)}
      >
        {children}
      </select>
      {error && <p id={`${id}-error`} className="text-[#b2372d] text-[0.75rem] pl-1 font-medium m-0">{error}</p>}
    </div>
  );
  return span2 ? <div className="md:col-span-2">{inner}</div> : inner;
}

export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm mt-6 flex flex-col sm:flex-row gap-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-slate-100 -mx-5 px-5 lg:mx-0 lg:px-0">
      {children}
    </div>
  );
}
