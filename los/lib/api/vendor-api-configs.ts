import { cachedAuthorizedLosGet, authorizedLosRequest } from './_shared';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export type LosVendorApiConfig = {
  id: number;
  apiCode: string;
  apiName: string;
  vendorName: string;
  priority: number;
  status: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function getVendorApiConfigs(token: string): Promise<LosVendorApiConfig[]> {
  const response = await cachedAuthorizedLosGet<{ vendorApiConfigs: LosVendorApiConfig[] }>(
    token,
    '/masters/vendor-api-configs',
    'Failed to fetch vendor API configs',
  );
  return response.vendorApiConfigs;
}

export async function createVendorApiConfig(
  token: string,
  data: {
    apiCode: string;
    apiName: string;
    vendorName: string;
    priority?: number;
    status?: string;
    notes?: string;
  },
): Promise<LosVendorApiConfig> {
  return authorizedLosRequest<LosVendorApiConfig>(
    token,
    '/masters/vendor-api-configs',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to create vendor API config',
  );
}

export async function updateVendorApiConfig(
  token: string,
  id: number,
  data: {
    apiName?: string;
    priority?: number;
    status?: string;
    notes?: string | null;
    isActive?: boolean;
  },
): Promise<LosVendorApiConfig> {
  return authorizedLosRequest<LosVendorApiConfig>(
    token,
    `/masters/vendor-api-configs/${id}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update vendor API config',
  );
}
