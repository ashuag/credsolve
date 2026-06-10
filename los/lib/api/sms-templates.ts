
import { cachedAuthorizedLosGet, authorizedLosRequest } from './_shared';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export type LosSmsTemplate = {
  id: number;
  templateId: string;
  bearerToken: string;
  message: string;
  product: string;
  isActive: boolean;
};

export async function getSmsTemplates(token: string): Promise<LosSmsTemplate[]> {
  const response = await cachedAuthorizedLosGet<{ smsTemplates: LosSmsTemplate[] }>(
    token,
    '/masters/sms-templates',
    'Failed to fetch SMS templates',
  );

  return response.smsTemplates;
}

export async function updateSmsTemplate(
  token: string,
  id: number,
  data: {
    templateId?: string;
    bearerToken?: string;
    message?: string;
    product?: string;
    isActive?: boolean;
  },
): Promise<LosSmsTemplate> {
  return authorizedLosRequest<LosSmsTemplate>(
    token,
    `/masters/sms-templates/${id}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) },
    'Failed to update SMS template',
  );
}
