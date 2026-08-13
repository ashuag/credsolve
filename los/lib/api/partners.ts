import { getLosServerApiBase } from '../api-env';
import { fetchWithTimeout, SERVER_REVALIDATE_SECONDS } from './_shared';

export type LosPartnerTeamMember = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
};

export type LosPartner = {
  id: string;
  companyName: string;
  phoneNumber: string;
  businessAddress: string;
  partnerType: string;
  status: 'ACTIVE' | 'PENDING_REGISTRATION' | string;
  owner: { fullName: string; email: string } | null;
  teamMembers: LosPartnerTeamMember[];
  assignedTours: unknown[];
};

const partnersFallback: LosPartner[] = [
  {
    id: 'partner-1',
    companyName: 'Sky Routes Travel',
    phoneNumber: '+971555000000',
    businessAddress: 'Dubai, UAE',
    partnerType: 'Company',
    status: 'ACTIVE',
    owner: {
      fullName: 'Sky Routes Travel',
      email: 'partner@moenycash.test',
    },
    teamMembers: [
      { id: 'member-1', name: 'Ops Coordinator', email: 'ops@sky-routes.test', roleLabel: 'View Only' },
    ],
    assignedTours: [],
  },
];

export async function getPartners(): Promise<LosPartner[]> {
  try {
    const response = await fetchWithTimeout(`${getLosServerApiBase()}/partners`, {
      next: { revalidate: SERVER_REVALIDATE_SECONDS },
    });
    if (!response.ok) return partnersFallback;
    return (await response.json()) as LosPartner[];
  } catch {
    return partnersFallback;
  }
}
