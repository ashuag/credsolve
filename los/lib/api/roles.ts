import {
  cachedAuthorizedLosGet,
  clientApiUrl,
  fetchWithTimeout,
  invalidateClientReadCache,
} from './_shared';

export type LosRole = {
  id: number;
  name: string;
  hierarchyLevel: number;
  isActive: boolean;
};

export async function getRoles(token: string): Promise<LosRole[]> {
  return cachedAuthorizedLosGet<LosRole[]>(token, '/roles', 'Failed to fetch roles');
}

export async function createRole(token: string, data: { name: string; hierarchyLevel: number }): Promise<LosRole> {
  const response = await fetchWithTimeout(`${clientApiUrl()}/roles`, {
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
  const response = await fetchWithTimeout(`${clientApiUrl()}/roles/${id}`, {
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
  const response = await fetchWithTimeout(`${clientApiUrl()}/roles/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to update role status');
  invalidateClientReadCache();
  return body as unknown as LosRole;
}
