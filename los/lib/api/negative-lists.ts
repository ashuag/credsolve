import { authorizedLosRequest, cachedAuthorizedLosGet } from './_shared';

export type LosNegativeListUser = {
  id: string;
  fullName: string;
  email: string;
};

export type LosNegativePincode = {
  id: number;
  pincode: string;
  reason: string | null;
  isActive: boolean;
  addedAt: string;
  removedAt: string | null;
  addedBy: LosNegativeListUser | null;
  removedBy: LosNegativeListUser | null;
};

export type LosNegativeCity = {
  id: number;
  cityId: number;
  cityName: string;
  stateName: string;
  stateCode: string;
  reason: string | null;
  isActive: boolean;
  addedAt: string;
  removedAt: string | null;
  addedBy: LosNegativeListUser | null;
  removedBy: LosNegativeListUser | null;
};

export type LosNegativeState = {
  id: number;
  stateId: number;
  stateName: string;
  stateCode: string;
  reason: string | null;
  isActive: boolean;
  addedAt: string;
  removedAt: string | null;
  addedBy: LosNegativeListUser | null;
  removedBy: LosNegativeListUser | null;
};

export type LosNegativeListsPayload = {
  pincodes: LosNegativePincode[];
  cities: LosNegativeCity[];
  states: LosNegativeState[];
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function getNegativeLists(token: string): Promise<LosNegativeListsPayload> {
  return cachedAuthorizedLosGet<LosNegativeListsPayload>(
    token,
    '/negative-lists',
    'Failed to fetch negative lists',
  );
}

export async function addNegativePincode(
  token: string,
  data: { pincode: string; reason?: string },
): Promise<LosNegativePincode> {
  return authorizedLosRequest<LosNegativePincode>(
    token,
    '/negative-lists/pincodes',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to add negative pincode',
  );
}

export async function removeNegativePincode(token: string, id: number): Promise<LosNegativePincode> {
  return authorizedLosRequest<LosNegativePincode>(
    token,
    `/negative-lists/pincodes/${id}`,
    { method: 'DELETE' },
    'Failed to remove negative pincode',
  );
}

export async function addNegativeCity(
  token: string,
  data: { cityId: number; reason?: string },
): Promise<LosNegativeCity> {
  return authorizedLosRequest<LosNegativeCity>(
    token,
    '/negative-lists/cities',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to add negative city',
  );
}

export async function removeNegativeCity(token: string, id: number): Promise<LosNegativeCity> {
  return authorizedLosRequest<LosNegativeCity>(
    token,
    `/negative-lists/cities/${id}`,
    { method: 'DELETE' },
    'Failed to remove negative city',
  );
}

export async function addNegativeState(
  token: string,
  data: { stateId: number; reason?: string },
): Promise<LosNegativeState> {
  return authorizedLosRequest<LosNegativeState>(
    token,
    '/negative-lists/states',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to add negative state',
  );
}

export async function removeNegativeState(token: string, id: number): Promise<LosNegativeState> {
  return authorizedLosRequest<LosNegativeState>(
    token,
    `/negative-lists/states/${id}`,
    { method: 'DELETE' },
    'Failed to remove negative state',
  );
}
