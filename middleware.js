/**
 * Next.js Middleware
 * Protects /dashboard and /admin routes — redirects unauthenticated users.
 * Restricts /admin to users with role === 'Admin'.
 */

import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Extract token from cookie
  const token = request.cookies.get('auth_token')?.value;

  // --- Protect /dashboard ---
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // --- Protect /admin ---
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (user.role !== 'Admin') {
      // Non-admins get redirected to their dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
