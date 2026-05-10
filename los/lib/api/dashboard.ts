import { API_URL, fetchWithTimeout, SERVER_REVALIDATE_SECONDS } from './_shared';

const fallback = {
  tours: [{ status: 'ACTIVE', _count: 1 }],
  bookings: [{ status: 'DEPOSIT_PAID', _count: 1 }],
  invitations: [{ status: 'BOOKED', _count: 1 }],
  partners: [{ status: 'ACTIVE', _count: 1 }],
  activeAgentsToday: 0,
  customers: 128,
  revenueReceived: 12450,
  recentActivity: [
    { id: '1', action: 'INVITATION_SENT', actorEmail: 'admin@moneycash.test', createdAt: '2026-03-28T12:00:00.000Z' }
  ]
};

export type LosCrmDashboard = typeof fallback & {
  activeAgentsToday: number;
};

export async function getDashboard(): Promise<LosCrmDashboard> {
  try {
    const response = await fetchWithTimeout(`${API_URL}/dashboard/crm`, {
      next: { revalidate: SERVER_REVALIDATE_SECONDS },
    });
    if (!response.ok) return fallback;
    const data = await response.json() as Partial<LosCrmDashboard>;

    return {
      ...fallback,
      ...data,
      activeAgentsToday: typeof data.activeAgentsToday === 'number' ? data.activeAgentsToday : fallback.activeAgentsToday,
    };
  } catch {
    return fallback;
  }
}
