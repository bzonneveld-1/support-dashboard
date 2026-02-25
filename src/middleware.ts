import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, createSessionToken, verifySessionToken } from '@/lib/auth';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|bold-logo.*\\.png).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Always allow the login page
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // POST to API routes use their own Bearer token auth — don't interfere
  if (method === 'POST' && pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    console.warn('[auth] DASHBOARD_SECRET not set — allowing all requests');
    return NextResponse.next();
  }

  // Method 1: URL key param (TV mode)
  const keyParam = request.nextUrl.searchParams.get('key');
  if (keyParam) {
    if (keyParam === secret) {
      // Strip key, keep ?tv. Use raw request.url — NextURL searchParams
      // drops valueless params like ?tv
      const hasTv = /[?&]tv(?:&|=|$)/.test(request.url);
      const target = request.nextUrl.origin + pathname + (hasTv ? '?tv' : '');
      const response = NextResponse.redirect(target);
      response.cookies.set(AUTH_COOKIE_NAME, await createSessionToken(secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: AUTH_COOKIE_MAX_AGE,
        path: '/',
      });
      return response;
    }
    // Invalid key — redirect to login
    return redirectToLogin(request);
  }

  // Method 2: Session cookie
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookieToken) {
    const valid = await verifySessionToken(cookieToken, secret);
    if (valid) return NextResponse.next();
  }

  // Not authenticated
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return redirectToLogin(request);
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const redirectPath = url.pathname + url.search;
  url.pathname = '/login';
  url.search = redirectPath !== '/' ? `?redirect=${encodeURIComponent(redirectPath)}` : '';
  return NextResponse.redirect(url);
}
