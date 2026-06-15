import { authorizedLosRequest, cachedAuthorizedLosGet } from './_shared';

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

export type LosSourceUtmMaster = {
  id: number;
  leadSourceId: number;
  leadSourceName: string;
  utmSource: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmMedium: string | null;
  utmContent: string | null;
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
  banks: LosNamedMaster[];
  rejectionReasons: LosNamedMaster[];
  sourceUtms: LosSourceUtmMaster[];
};

export type LosEligibilityCriterion = {
  id: number;
  key: string;
  label: string;
  value: string;
  breType: 'PRE_BRE' | 'POST_BRE' | string;
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

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function getMasters(token: string): Promise<LosMastersPayload> {
  return cachedAuthorizedLosGet<LosMastersPayload>(token, '/masters', 'Failed to fetch masters');
}

// ─── Statuses (lead + application) ───────────────────────────────────────────

export async function updateLeadStatus(
  token: string,
  id: number,
  data: { displayName?: string; isActive?: boolean },
): Promise<LosStatusMaster> {
  return authorizedLosRequest<LosStatusMaster>(
    token,
    `/masters/lead-statuses/${id}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update lead status',
  );
}

export async function updateApplicationStatus(
  token: string,
  id: number,
  data: { displayName?: string; isActive?: boolean },
): Promise<LosStatusMaster> {
  return authorizedLosRequest<LosStatusMaster>(
    token,
    `/masters/application-statuses/${id}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update application status',
  );
}

// ─── Lead sources ────────────────────────────────────────────────────────────

export async function createLeadSource(
  token: string,
  data: { name: string; type: LosLeadSourceType },
): Promise<LosLeadSourceMaster> {
  return authorizedLosRequest<LosLeadSourceMaster>(
    token,
    '/masters/lead-sources',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update lead source',
  );
}

export async function createSourceUtm(
  token: string,
  data: {
    leadSourceId: number;
    utmSource?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmMedium?: string;
    utmContent?: string;
  },
): Promise<LosSourceUtmMaster> {
  return authorizedLosRequest<LosSourceUtmMaster>(
    token,
    '/masters/source-utms',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to create source UTM',
  );
}

export async function updateSourceUtm(
  token: string,
  id: number,
  data: {
    utmSource?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmMedium?: string;
    utmContent?: string;
    isActive?: boolean;
  },
): Promise<LosSourceUtmMaster> {
  return authorizedLosRequest<LosSourceUtmMaster>(
    token,
    `/masters/source-utms/${id}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update source UTM',
  );
}

// ─── States + cities ─────────────────────────────────────────────────────────

export async function createState(
  token: string,
  data: { name: string; code: string },
): Promise<LosStateMaster> {
  return authorizedLosRequest<LosStateMaster>(
    token,
    '/masters/states',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update city',
  );
}

// ─── Named masters (occupation, reason, gender, bank) ────────────────────────

export async function createOccupation(
  token: string,
  data: { name: string },
): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    '/masters/occupations',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update gender',
  );
}

export async function createBank(token: string, data: { name: string }): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    '/masters/banks',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to create bank',
  );
}

export async function updateBank(
  token: string,
  id: number,
  data: { name?: string; isActive?: boolean },
): Promise<LosNamedMaster> {
  return authorizedLosRequest<LosNamedMaster>(
    token,
    `/masters/banks/${id}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update bank',
  );
}

export async function deleteBank(token: string, id: number): Promise<{ ok: true }> {
  return authorizedLosRequest<{ ok: true }>(
    token,
    `/masters/banks/${id}`,
    { method: 'DELETE' },
    'Failed to delete bank',
  );
}

// ─── Eligibility criteria + credit limit tiers ───────────────────────────────

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
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
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
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update credit limit tier',
  );
}
