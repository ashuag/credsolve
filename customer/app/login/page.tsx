import { Suspense } from 'react';
import { OtpVerificationForm } from './otp-verification-form';

export default function LoginPage() {
  return (
    <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <Suspense
        fallback={
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-[40px] w-[40px] rounded-full border-4 border-[#1c347d1a] border-t-brand-blue animate-spin" />
          </div>
        }
      >
        <OtpVerificationForm />
      </Suspense>
    </div>
  );
}
