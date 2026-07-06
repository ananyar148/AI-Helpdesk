/**
 * Next.js Middleware — Route Protection + RBAC
 *
 * /dashboard  → TeamMember or Admin (redirect Admin to /admin)
 * /admin      → Admin only
 * /tickets/*  → TeamMember or Admin
 * /settings   → Any authenticated user
 */

import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // Helper: get verified user or null
  const getUser = () => (token ? verifyToken(token) : null);

  // ── /dashboard ────────────────────────────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    const user = await getUser();
    if (!user) return NextResponse.redirect(new URL('/login', request.url));
    // Admins should be on /admin
    if (user.role === 'Admin') return NextResponse.redirect(new URL('/admin', request.url));
  }

  // ── /admin ────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const user = await getUser();
    if (!user) return NextResponse.redirect(new URL('/login', request.url));
    if (user.role !== 'Admin') return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ── /tickets/* ───────────────────────────────────────────────────────
  if (pathname.startsWith('/tickets')) {
    const user = await getUser();
    if (!user) return NextResponse.redirect(new URL('/login', request.url));
    // Clients (unauthenticated users) cannot access ticket detail pages
    // API enforces team-scoping; middleware just ensures login
  }

  // ── /settings ────────────────────────────────────────────────────────
  if (pathname.startsWith('/settings')) {
    const user = await getUser();
    if (!user) return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/tickets/:path*',
    '/settings/:path*',
    // /portal/* is intentionally excluded — protected by NextAuth session, not JWT
  ],
};
