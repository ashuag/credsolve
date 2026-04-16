import type { Dashboard, Tour } from '../dashboard';

const MOCK_TOUR: Tour = {
  name: 'European Summer Escape',
  startDate: '2026-06-14T00:00:00.000Z',
  endDate: '2026-06-22T00:00:00.000Z',
  cities: ['Paris', 'Lucerne', 'Venice'],
  currency: 'INR',
  twinSharingPrice: 189999,
  singleSupplementPrice: 44999,
  coverImageUrl:
    'https://images.unsplash.com/photo-1502602898536-47ad22581b52?auto=format&fit=crop&w=1200&q=80'
};

const MOCK_DASHBOARD: Dashboard = {
  bookings: [
    {
      id: 'booking-eu-summer',
      reference: 'MC-2026-00124',
      tour: MOCK_TOUR,
      invoices: [
        {
          id: 'invoice-eu-summer-balance',
          invoiceNumber: 'INV-240301',
          amountOutstanding: 24999
        }
      ]
    }
  ],
  outstandingPayments: [
    {
      id: 'payment-eu-summer-balance',
      amount: 24999,
      method: 'UPI',
      status: 'Pending'
    }
  ]
};

export function getMockDashboard(): Dashboard {
  return {
    bookings: MOCK_DASHBOARD.bookings.map((booking) => ({
      ...booking,
      tour: { ...booking.tour, cities: [...booking.tour.cities] },
      invoices: booking.invoices.map((invoice) => ({ ...invoice }))
    })),
    outstandingPayments: MOCK_DASHBOARD.outstandingPayments.map((payment) => ({ ...payment }))
  };
}

export function getMockTour(): Tour {
  return {
    ...MOCK_TOUR,
    cities: [...MOCK_TOUR.cities]
  };
}
