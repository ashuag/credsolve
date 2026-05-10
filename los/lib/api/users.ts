import {
  cachedAuthorizedLosGet,
  clientApiUrl,
  fetchWithTimeout,
  invalidateClientReadCache,
  messageFromBody,
  parseJsonResponse,
} from './_shared';
import type { LosRole } from './roles';

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

export async function createUser(
  token: string,
  data: { fullName: string; email: string; roleId: number; managerId?: string | null }
): Promise<LosUser> {
  const response = await fetchWithTimeout(`${clientApiUrl()}/users`, {
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
  const response = await fetchWithTimeout(`${clientApiUrl()}/users/${id}`, {
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
  const response = await fetchWithTimeout(`${clientApiUrl()}/users/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to update status');
  invalidateClientReadCache();
  return body as unknown as LosUser;
}

export async function resendUserInvitation(token: string, id: string): Promise<LosUser> {
  const response = await fetchWithTimeout(`${clientApiUrl()}/users/${id}/resend-invitation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error((body['message'] as string) ?? 'Failed to resend invitation');
  invalidateClientReadCache();
  return body as unknown as LosUser;
}

export async function updateLosPassword(
  token: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<{ success: boolean }> {
  const response = await fetchWithTimeout(`${clientApiUrl()}/auth/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(messageFromBody(body) ?? 'Failed to update password');
  }
  return (body as { success?: boolean })?.success ? { success: true } : { success: true };
}
