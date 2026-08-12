import { NextRequest } from 'next/server';
import { proxyLosApiRequest } from '@/lib/api-proxy';

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

/**
 * Browser calls same-origin `/api/los/...` (e.g. `/api/los/auth/login`).
 * This handler forwards to Nest `API_SERVER_URL` (`.../api/los/...`).
 */
async function handle(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxyLosApiRequest(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
