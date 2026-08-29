import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/',
  '/auth/login',
  '/auth/accept-invite',
  '/auth/request-invite',
  '/auth/error',
  '/api/auth',
  '/api/webhooks',
];

const adminPaths = ['/admin'];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublicPath = publicPaths.some((path) => nextUrl.pathname.startsWith(path));
  const isAdminPath = adminPaths.some((path) => nextUrl.pathname.startsWith(path));
  const isApiPath = nextUrl.pathname.startsWith('/api');

  // Allow public paths
  if (isPublicPath) {
    // Logged-in users skip marketing pages and go straight to the dashboard
    if (isLoggedIn && nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }
    // Redirect logged-in users away from login page
    if (isLoggedIn && nextUrl.pathname === '/auth/login') {
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }
    return NextResponse.next();
  }

  // Protect API routes
  if (isApiPath) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Require authentication for all other paths
  if (!isLoggedIn) {
    const loginUrl = new URL('/auth/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin access
  if (isAdminPath && req.auth?.user?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  // Check if user is suspended
  if (req.auth?.user?.status === 'SUSPENDED') {
    return NextResponse.redirect(new URL('/auth/suspended', nextUrl));
  }

  // Check if user needs KYC
  if (req.auth?.user?.status === 'KYC_REQUIRED' && !nextUrl.pathname.startsWith('/kyc')) {
    return NextResponse.redirect(new URL('/kyc', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};