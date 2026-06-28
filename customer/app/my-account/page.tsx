import type { Metadata } from 'next';
import { MyAccountClientPage } from './my-account-client-page';

export const metadata: Metadata = {
  title: 'Log in — My account',
  description:
    'Sign in with your registered mobile number and OTP to access your MoneyCash dashboard, resume applications, and manage your loans.',
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
