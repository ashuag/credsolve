import type { Metadata } from 'next';
import { OnboardingFlow } from './onboarding-flow';

export const metadata: Metadata = {
  title: 'Complete Your Profile | MoneyCash',
  description:
    'Provide your email address and personal details to complete your MoneyCash loan application.',
};

export default function OnboardingPage() {
  // #region agent log
  void fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'server-render',hypothesisId:'S1',location:'customer/app/onboarding/page.tsx:13',message:'Onboarding page render',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return (
    <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <OnboardingFlow />
    </div>
  );
}
