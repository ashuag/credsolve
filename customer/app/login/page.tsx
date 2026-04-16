import { Suspense } from 'react';
import { OtpVerificationForm } from './otp-verification-form';

export default function LoginPage() {
  // #region agent log
  void fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'server-render',hypothesisId:'S2',location:'customer/app/login/page.tsx:6',message:'Login page render',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
