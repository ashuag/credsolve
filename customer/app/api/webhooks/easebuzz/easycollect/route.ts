import { NextRequest } from 'next/server';
import { proxyCustomerApiRequest } from '@/lib/api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Easebuzz EasyCollect webhook (public — do not use api.moneycash.in):
 *   https://moneycash.in/api/webhooks/easebuzz/easycollect
 *
 * Separate from Pay Now:
 *   https://moneycash.in/api/webhooks/easebuzz/repayment
 *
 * Forwards the same method, query, headers, and body to Nest
 * `{API_SERVER_URL}/webhooks/easebuzz/easycollect`.
 */
async function handle(request: NextRequest) {
  return proxyCustomerApiRequest(request, ['webhooks', 'easebuzz', 'easycollect'], {
    timeoutMs: 90_000,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const HEAD = handle;
export const OPTIONS = handle;
