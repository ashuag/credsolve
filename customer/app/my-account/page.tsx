import type { Metadata } from 'next';
import { MyAccountClientPage } from './my-account-client-page';

export const metadata: Metadata = {
  title: 'My account — CredSolve',
  description:
    'Your CredSolve account hub — view previous loans, track active repayments, and complete your loan journey.',
  openGraph: {
    title: 'Log in — My account | CredSolve',
    description:
      'Secure OTP login to your CredSolve account — dashboard, applications, and loan management.',
    type: 'website'
  }
};

export default function MyAccountPage() {
  return <MyAccountClientPage />;
}
