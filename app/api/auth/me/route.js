/**
 * /api/auth/me
 * GET - Return the current authenticated user from cookie.
 */

import { NextResponse } from 'next/server';
import { getUserFromRequest } from '../../../../lib/auth';

export async function GET(request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team,
    },
  });
}
