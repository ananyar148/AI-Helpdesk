/**
 * /api/users/active
 * GET - Return all active team members (for assignment picker).
 *       Accessible to all authenticated team users (Admin + TeamMember).
 */

import { NextResponse }        from 'next/server';
import prisma                  from '../../../../lib/prisma';
import { getUserFromRequest }  from '../../../../lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const users = await prisma.user.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, email: true, role: true, team: true },
      orderBy: [{ team: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error('GET /api/users/active error:', err);
    return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
  }
}
