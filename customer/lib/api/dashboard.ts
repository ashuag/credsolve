import { getMockDashboard } from './mocks/dashboard.mock';

export type Invoice = {
  id: string;
  invoiceNumber: string;
  amountOutstanding: number;
};

export type Tour = {
  name: string;
  startDate: string;
  endDate: string;
  cities: string[];
  currency: string;
  twinSharingPrice: number;
  singleSupplementPrice: number;
  coverImageUrl: string;
};

export type Booking = {
  id: string;
  reference: string;
  tour: Tour;
  invoices: Invoice[];
};

export type OutstandingPayment = {
  id: string;
  amount: number;
  method: string;
  status: string;
};

export type Dashboard = {
  bookings: Booking[];
  outstandingPayments: OutstandingPayment[];
};

export async function getDashboard(): Promise<Dashboard> {
  return getMockDashboard();
}
