import type { Metadata } from 'next';
import { CustomerDashboard } from '@/components/dashboard/customer-dashboard';

export const metadata: Metadata = {
  title: 'My accounts',
  description: 'View your MoneyCash loans, repayment schedule, applications in progress, and history.',
};

export default function DashboardPage() {
  return <CustomerDashboard />;
}
