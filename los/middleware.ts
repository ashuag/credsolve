import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LOS_COOKIE_NAME } from '@/lib/auth';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/leads',
  '/applications',
  '/agents',
  '/roles',
  '/partners',
  '/masters',
  '/eligibility-criteria',
] as const;

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.get(LOS_COOKIE_NAME)?.value === '1';
  const { pathname } = request.nextUrl;
  const isProtectedPath = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isProtectedPath && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/leads/:path*',
    '/applications/:path*',
    '/agents/:path*',
    '/roles/:path*',
    '/partners/:path*',
    '/masters/:path*',
    '/eligibility-criteria/:path*',
  ],
};
