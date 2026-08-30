import { NextRequest, NextResponse } from 'next/server';
import { proxyCustomerApiRequest } from '@/lib/api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ kind?: string }>;
};

/**
 * Easebuzz Pay confirm URLs (surl/furl). Same public-host pattern as the webhook —
 * Easebuzz and the browser hit moneycash.in, not api.moneycash.in:
 *   https://moneycash.in/api/auth/repayments/easebuzz/success
 *   https://moneycash.in/api/auth/repayments/easebuzz/failure
 *
 * Forwards the same payload to Nest, which verifies hash, confirms via
 * Transaction V2.1, settles, then 303s back to My Account.
 */
async function handle(request: NextRequest, context: RouteContext) {
  const { kind } = await context.params;
  if (kind !== 'success' && kind !== 'failure') {
    return NextResponse.json({ message: 'Not found.' }, { status: 404 });
  }
  return proxyCustomerApiRequest(request, ['auth', 'repayments', 'easebuzz', kind], {
    timeoutMs: 90_000,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const HEAD = handle;
export const OPTIONS = handle;
