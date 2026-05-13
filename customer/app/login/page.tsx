import { Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { OtpVerificationForm } from './otp-verification-form';

export default function LoginPage() {
  return (
    <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <Suspense
        fallback={
          <div className="flex min-h-[400px] items-center justify-center">
            <Spinner size={40} />
          </div>
        }
      >
        <OtpVerificationForm />
      </Suspense>
    </div>
  );
}
