import { NextRequest } from 'next/server';
import { proxyLosApiRequest } from '@/lib/api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Workbook / CIBIL PDF downloads may run past the platform default (often 30s). */
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

/**
 * Same shape as customer `app/api/[[...path]]`.
 * Browser calls `/api/los/auth/login` → segments `['los','auth','login']` → Nest `/api/los/auth/login`.
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
