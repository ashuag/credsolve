const API_URL = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/los';
const SERVER_REVALIDATE_SECONDS = 30;
const CLIENT_READ_CACHE_TTL_MS = 30_000;

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

const partnersFallback = [
  {
    id: 'partner-1',
    companyName: 'Sky Routes Travel',
    phoneNumber: '+971555000000',
    businessAddress: 'Dubai, UAE',
    partnerType: 'Company',
    status: 'ACTIVE',
    owner: {
      fullName: 'Sky Routes Travel',
      email: 'partner@moenycash.test'
    },
    teamMembers: [{ id: 'member-1', name: 'Ops Coordinator', email: 'ops@sky-routes.test', roleLabel: 'View Only' }],
    assignedTours: []
  }
];

export async function getDashboard(): Promise<LosCrmDashboard> {
  try {
    const response = await fetch(`${API_URL}/dashboard/crm`, {
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

export async function getPartners() {
  try {
    const response = await fetch(`${API_URL}/partners`, {
      next: { revalidate: SERVER_REVALIDATE_SECONDS },
    });
    if (!response.ok) return partnersFallback;
    return response.json();
  } catch {
    return partnersFallback;
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function clientApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/los';
}

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

function messageFromBody(body: unknown) {
  return typeof body === 'object' && body !== null && 'message' in body
    ? (body as { message?: string }).message
    : undefined;
}

type ClientReadCacheEntry = {
  expiresAt: number;
  data: unknown;
};

const clientReadCache = new Map<string, ClientReadCacheEntry>();
const clientReadInFlight = new Map<string, Promise<unknown>>();

function clientReadCacheKey(token: string, path: string) {
  return `${token}:${path}`;
}

function invalidateClientReadCache() {
  clientReadCache.clear();
  clientReadInFlight.clear();
}

async function cachedAuthorizedLosGet<T>(
  token: string,
  path: string,
  fallbackMessage: string,
): Promise<T> {
  const key = clientReadCacheKey(token, path);
  const now = Date.now();
  const cached = clientReadCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const inflight = clientReadInFlight.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const request = (async () => {
    const response = await fetch(`${clientApiUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = await parseJsonResponse(response);

    if (!response.ok) {
      const message = typeof body === 'object' && body !== null && 'message' in body
        ? (body as { message?: string }).message
        : undefined;
      throw new Error(message ?? fallbackMessage);
    }

    clientReadCache.set(key, {
      expiresAt: Date.now() + CLIENT_READ_CACHE_TTL_MS,
      data: body,
    });

    return body as T;
  })();

  clientReadInFlight.set(key, request);

  try {
    return await request;
  } finally {
    clientReadInFlight.delete(key);
  }
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export type LosRole = {
  id: number;
  name: string;
  hierarchyLevel: number;
  isActive: boolean;
};

export type LosLead = {
  uuid: string;
  customerUuid: string;
  mobileNumber: string;
  email: string | null;
  statusCode: string;
  statusLabel: string;
  sourceName: string | null;
  sourceType: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LosApplication = {
  uuid: string;
  customerUuid: string;
  leadUuid: string | null;
  mobileNumber: string;
  email: string | null;
  fullName: string | null;
  loanAmount: string | null;
  statusCode: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export async function getRoles(token: string): Promise<LosRole[]> {
  return cachedAuthorizedLosGet<LosRole[]>(token, '/roles', 'Failed to fetch roles');
}

export async function createRole(token: string, data: { name: string; hierarchyLevel: number }): Promise<LosRole> {
  const response = await fetch(`${clientApiUrl()}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to create role');
  invalidateClientReadCache();
  return body as unknown as LosRole;
}

export async function updateRole(
  token: string,
  id: number,
  data: { name?: string; hierarchyLevel?: number }
): Promise<LosRole> {
  const response = await fetch(`${clientApiUrl()}/roles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to update role');
  invalidateClientReadCache();
  return body as unknown as LosRole;
}

export async function toggleRoleStatus(token: string, id: number): Promise<LosRole> {
  const response = await fetch(`${clientApiUrl()}/roles/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to update role status');
  invalidateClientReadCache();
  return body as unknown as LosRole;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export type LosUser = {
  id: string;
  fullName: string;
  email: string;
  roleId: number;
  managerId: string | null;
  manager: {
    id: string;
    fullName: string;
    email: string;
    roleId: number;
    userRole: LosRole | null;
    isActive: boolean;
  } | null;
  userRole: LosRole | null;
  isActive: boolean;
  invitationSentAt: string | null;
  invitationExpiresAt: string | null;
  registrationCompletedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getUsers(token: string): Promise<LosUser[]> {
  return cachedAuthorizedLosGet<LosUser[]>(token, '/users', 'Failed to fetch users');
}

export async function getNewLeads(token: string): Promise<LosLead[]> {
  return cachedAuthorizedLosGet<LosLead[]>(token, '/leads/new', 'Failed to fetch new leads');
}

export async function getApplications(token: string): Promise<LosApplication[]> {
  return cachedAuthorizedLosGet<LosApplication[]>(token, '/applications', 'Failed to fetch applications');
}

export async function createUser(
  token: string,
  data: { fullName: string; email: string; roleId: number; managerId?: string | null }
): Promise<LosUser> {
  const response = await fetch(`${clientApiUrl()}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to create user');
  invalidateClientReadCache();
  return body as unknown as LosUser;
}

export async function updateUser(
  token: string,
  id: string,
  data: { fullName?: string; email?: string; roleId?: number; managerId?: string | null }
): Promise<LosUser> {
  const response = await fetch(`${clientApiUrl()}/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to update user');
  invalidateClientReadCache();
  return body as unknown as LosUser;
}

export async function toggleUserStatus(token: string, id: string): Promise<LosUser> {
  const response = await fetch(`${clientApiUrl()}/users/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to update status');
  invalidateClientReadCache();
  return body as unknown as LosUser;
}

export async function resendUserInvitation(token: string, id: string): Promise<LosUser> {
  const response = await fetch(`${clientApiUrl()}/users/${id}/resend-invitation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to resend invitation');
  invalidateClientReadCache();
  return body as unknown as LosUser;
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export type LosInvitationPreview = {
  fullName: string;
  email: string;
  roleName: string | null;
  expiresAt: string;
};

export async function getInvitationPreview(token: string): Promise<LosInvitationPreview> {
  const response = await fetch(`${clientApiUrl()}/auth/invitations/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) throw new Error(messageFromBody(body) ?? 'Password setup link has expired.');
  return body as unknown as LosInvitationPreview;
}

export async function acceptInvitation(token: string, data: { password: string }): Promise<{ message: string }> {
  const response = await fetch(`${clientApiUrl()}/auth/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) throw new Error(messageFromBody(body) ?? 'Password setup link has expired.');
  return body as { message: string };
}

// ─── Masters ─────────────────────────────────────────────────────────────────

export const LOS_LEAD_SOURCE_TYPES = ['ADS', 'CONNECTOR', 'SALES', 'ORGANIC', 'PARTNER', 'API'] as const;

export type LosLeadSourceType = (typeof LOS_LEAD_SOURCE_TYPES)[number];

export type LosStatusMaster = {
  id: number;
  code: string;
  displayName: string;
  customDisplayName: string | null;
  isActive: boolean;
};

export type LosLeadSourceMaster = {
  id: number;
  name: string;
  type: LosLeadSourceType;
  isActive: boolean;
};

export type LosStateMaster = {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
};

export type LosCityMaster = {
  id: number;
  name: string;
  stateId: number;
  stateName: string;
  stateCode: string;
  stateIsActive: boolean;
  isActive: boolean;
};

export type LosNamedMaster = {
  id: number;
  name: string;
  isActive: boolean;
};

export type LosMastersPayload = {
  leadStatuses: LosStatusMaster[];
  applicationStatuses: LosStatusMaster[];
  leadSources: LosLeadSourceMaster[];
  states: LosStateMaster[];
  cities: LosCityMaster[];
  occupations: LosNamedMaster[];
  reasonsForLoan: LosNamedMaster[];
  genders: LosNamedMaster[];
};

export type LosEligibilityCriterion = {
  id: number;
  key: string;
  label: string;
  value: string;
  description: string | null;
  isActive: boolean;
};

export type LosCreditLimitTier = {
  id: number;
  minUnsecuredLoan: number;
  maxUnsecuredLoan: number | null;
  maxBulletLoan: number;
  sortOrder: number;
  isActive: boolean;
};

async function parseLosError(response: Response, fallbackMessage: string) {
  const body = await parseJsonResponse(response);
  return messageFromBody(body) ?? fallbackMessage;
}

async function authorizedLosRequest<T>(
  token: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const response = await fetch(`${clientApiUrl()}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(messageFromBody(body) ?? fallbackMessage);
  }

  if (method !== 'GET' && method !== 'HEAD') {
    invalidateClientReadCache();
  }

  return body as unknown as T;
}

export async function getMasters(token: string): Promise<LosMastersPayload> {
  return cachedAuthorizedLosGet<LosMastersPayload>(token, '/masters', 'Failed to fetch masters');
}

export async function updateLeadStatus(
  token: string,
  id: number,
  data: { displayName?: string; isActive?: boolean },
): Promise<LosStatusMaster> {
  return authorizedLosRequest<LosStatusMaster>(
    token,
    `/masters/lead-statuses/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update lead status',
  );
}

export async function updateLeadStatusDisplayName(
  token: string,
  id: number,
  data: { displayName: string },
): Promise<LosStatusMaster> {
  return updateLeadStatus(token, id, data);
}

export async function updateApplicationStatus(
  token: string,
  id: number,
  data: { displayName?: string; isActive?: boolean },
): Promise<LosStatusMaster> {
  return authorizedLosRequest<LosStatusMaster>(
    token,
    `/masters/application-statuses/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update application status',
  );
}

export async function updateApplicationStatusDisplayName(
  token: string,
  id: number,
  data: { displayName: string },
): Promise<LosStatusMaster> {
  return updateApplicationStatus(token, id, data);
}

export async function createLeadSource(
  token: string,
  data: { name: string; type: LosLeadSourceType },
): Promise<LosLeadSourceMaster> {
  return authorizedLosRequest<LosLeadSourceMaster>(
    token,
    '/masters/lead-sources',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to create lead source',
  );
}

export async function updateLeadSource(
  token: string,
  id: number,
  data: { name?: string; type?: LosLeadSourceType; isActive?: boolean },
): Promise<LosLeadSourceMaster> {
  return authorizedLosRequest<LosLeadSourceMaster>(
    token,
    `/masters/lead-sources/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update lead source',
  );
}

export async function createState(
  token: string,
  data: { name: string; code: string },
): Promise<LosStateMaster> {
  return authorizedLosRequest<LosStateMaster>(
    token,
    '/masters/states',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to create state',
  );
}

export async function updateState(
  token: string,
  id: number,
  data: { name?: string; code?: string; isActive?: boolean },
): Promise<LosStateMaster> {
  return authorizedLosRequest<LosStateMaster>(
    token,
    `/masters/states/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update state',
  );
}

export async function createCity(
  token: string,
  data: { name: string; stateId: number },
): Promise<LosCityMaster> {
  return authorizedLosRequest<LosCityMaster>(
    token,
    '/masters/cities',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to create city',
  );
}

export async function updateCity(
  token: string,
  id: number,
  data: { name?: string; stateId?: number; isActive?: boolean },
): Promise<LosCityMaster> {
  return authorizedLosRequest<LosCityMaster>(
    token,
    `/masters/cities/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update city',
  );
}

export async function createOccupation(
  token: string,
  data: { name: string },
): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    '/masters/occupations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to create occupation',
  );
}

export async function updateOccupation(
  token: string,
  id: number,
  data: { name?: string; isActive?: boolean },
): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    `/masters/occupations/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update occupation',
  );
}

export async function createReasonForLoan(
  token: string,
  data: { name: string },
): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    '/masters/reasons-for-loan',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to create reason for loan',
  );
}

export async function updateReasonForLoan(
  token: string,
  id: number,
  data: { name?: string; isActive?: boolean },
): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    `/masters/reasons-for-loan/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update reason for loan',
  );
}

export async function createGender(
  token: string,
  data: { name: string },
): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    '/masters/genders',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to create gender',
  );
}

export async function updateGender(
  token: string,
  id: number,
  data: { name?: string; isActive?: boolean },
): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    `/masters/genders/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update gender',
  );
}

export async function getEligibilityCriteria(token: string): Promise<LosEligibilityCriterion[]> {
  const response = await cachedAuthorizedLosGet<{ eligibilityCriteria: LosEligibilityCriterion[] }>(
    token,
    '/masters/eligibility-criteria',
    'Failed to fetch eligibility criteria',
  );

  return response.eligibilityCriteria;
}

export async function updateEligibilityCriterion(
  token: string,
  id: number,
  data: { value?: string; isActive?: boolean },
): Promise<LosEligibilityCriterion> {
  return authorizedLosRequest<LosEligibilityCriterion>(
    token,
    `/masters/eligibility-criteria/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update eligibility criterion',
  );
}

export async function getCreditLimitTiers(token: string): Promise<LosCreditLimitTier[]> {
  const response = await cachedAuthorizedLosGet<{ creditLimitTiers: LosCreditLimitTier[] }>(
    token,
    '/masters/credit-limit-tiers',
    'Failed to fetch credit limit tiers',
  );

  return response.creditLimitTiers;
}

export async function updateCreditLimitTier(
  token: string,
  id: number,
  data: {
    minUnsecuredLoan?: number;
    maxUnsecuredLoan?: number | null;
    maxBulletLoan?: number;
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<LosCreditLimitTier> {
  return authorizedLosRequest<LosCreditLimitTier>(
    token,
    `/masters/credit-limit-tiers/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update credit limit tier',
  );
}
