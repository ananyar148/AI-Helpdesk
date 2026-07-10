/**
 * GET /api/portal/client-auth/me
 * Return the currently signed-in client user (from client_token cookie).
 */

import { NextResponse } from 'next/server';
import { getClientFromRequest } from '../../../../../lib/clientAuth';

export async function GET(request) {
  const client = await getClientFromRequest(request);
  if (!client) return NextResponse.json({ client: null }, { status: 401 });
  return NextResponse.json({ client });
}
