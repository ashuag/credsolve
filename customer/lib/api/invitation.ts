import type { Tour } from './dashboard';
import { getMockTour } from './mocks/dashboard.mock';

export type Invitation = {
  customerName: string;
  tour: Tour;
};

export async function getInvitation(token: string): Promise<Invitation> {
  const trimmedToken = token.trim();

  return {
    customerName: trimmedToken ? 'Invited MoneyCash customer' : 'MoneyCash customer',
    tour: getMockTour()
  };
}
