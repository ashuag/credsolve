import type { Metadata } from 'next';
import { CustomerDashboard } from '@/components/dashboard/customer-dashboard';

export const metadata: Metadata = {
  title: 'My accounts',
  description: 'View your CredSolve loans, repayment schedule, applications in progress, and history.',
};

import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/my-account');
}
