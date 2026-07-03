/**
 * /api/tickets/[id]/activity
 * GET - Fetch the activity timeline for a ticket (protected)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../lib/auth';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    if (user.role === 'TeamMember' && !ticket.assignedTeams.includes(user.team)) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const activities = await prisma.ticketActivity.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ activities });
  } catch (err) {
    console.error('GET /api/tickets/[id]/activity error:', err);
    return NextResponse.json({ error: 'Failed to fetch activity.' }, { status: 500 });
  }
}
