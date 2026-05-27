/**
 * Bureau response used when `BUREAU_FETCH_ENABLED` = `2` (mock mode; no Tenacio HTTP).
 * Uses a real CIBIL soft-pull sample (score 789, five tradelines) for tradeline/tier testing.
 */
import bureauSampleData from './fixtures/tenacio-bureau-sample-data.json';

export const TENACIO_BUREAU_MOCK_VENDOR_BODY: Record<string, unknown> = {
  ...(bureauSampleData as Record<string, unknown>),
  type: 'point',
  status: 'success',
  requestId: '3f70e0fc-dab4-4718-a764-5a4a8a7c50c8',
  vendorResponse: [{ name: 'SapphireSwan', sequence: 1, statusCode: 200 }],
  serviceStatusCode: 200,
};
