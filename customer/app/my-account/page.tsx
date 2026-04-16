import type { Metadata } from 'next';
import { MyAccountAccessFlow } from '@/components/account/my-account-access-flow';

export const metadata: Metadata = {
  title: 'My Account',
  description:
    'Enter your mobile number to apply for a MoneyCash loan or log in to an existing application.'
};

export default function MyAccountPage() {
  return <MyAccountAccessFlow />;
}
