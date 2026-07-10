/**
 * POST /api/portal/client-auth/logout
 * Clear the client_token cookie.
 */

import { NextResponse } from 'next/server';
import { clearClientCookie } from '../../../../../lib/clientAuth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  clearClientCookie(res);
  return res;
}
