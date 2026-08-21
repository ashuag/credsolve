import { authorizedLosRequest, cachedAuthorizedLosGet } from './_shared';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export type LosSetting = {
  id: number;
  key: string;
  value: string;
  description: string | null;
  isActive: boolean;
};

export async function getSettings(token: string): Promise<LosSetting[]> {
  const response = await cachedAuthorizedLosGet<{ settings: LosSetting[] }>(
    token,
    '/masters/settings',
    'Failed to fetch settings',
  );

  return response.settings;
}

export async function updateSetting(
  token: string,
  id: number,
  data: {
    value?: string;
    description?: string;
    isActive?: boolean;
  },
): Promise<LosSetting> {
  return authorizedLosRequest<LosSetting>(
    token,
    `/masters/settings/${id}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update setting',
  );
}
