import type { Metadata } from 'next';
import { MyAccountClientPage } from './my-account-client-page';

export const metadata: Metadata = {
  title: 'My account — MoneyCash',
  description:
    'Your MoneyCash account hub — view previous loans, track active repayments, and complete your loan journey.',
  openGraph: {
    title: 'Log in — My account | MoneyCash',
    description:
      'Secure OTP login to your MoneyCash account — dashboard, applications, and loan management.',
    type: 'website'
  }
};

export default function MyAccountPage() {
  return <MyAccountClientPage />;
}
