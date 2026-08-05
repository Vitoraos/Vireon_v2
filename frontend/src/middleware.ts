/**
 * Next.js middleware.
 * Defensive: ensures no route leads to a dead 404.
 * Redirects unknown paths to home.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const VALID_PATHS = ['/', '/intake', '/doctor'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow API routes, static files, and valid paths
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    VALID_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  // Redirect everything else to home to prevent 404s
  return NextResponse.redirect(new URL('/', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.).*)'],
};
