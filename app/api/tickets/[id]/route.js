/**
 * /api/tickets/[id]
 * GET    - Fetch single ticket (protected)
 * PATCH  - Update ticket status or team (protected)
 * DELETE - Delete ticket (admin only)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';

// GET /api/tickets/[id]
export async function GET(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    // Team members can only see their team's tickets
    if (user.role === 'TeamMember' && ticket.assignedTeam !== user.team) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error('GET /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch ticket.' }, { status: 500 });
  }
}

// PATCH /api/tickets/[id] — update status and/or assignedTeam
export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { status, assignedTeam } = body;

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    // Team members can only update tickets assigned to their team
    if (user.role === 'TeamMember' && ticket.assignedTeam !== user.team) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Only admins can reassign tickets
    if (assignedTeam && user.role !== 'Admin') {
      return NextResponse.json(
        { error: 'Only admins can reassign tickets.' },
        { status: 403 }
      );
    }

    // Validate status value
    const validStatuses = ['Open', 'In Progress', 'Resolved'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate team value
    const validTeams = ['Development', 'Billing', 'HR', 'Support'];
    if (assignedTeam && !validTeams.includes(assignedTeam)) {
      return NextResponse.json(
        { error: `Invalid team. Must be one of: ${validTeams.join(', ')}` },
        { status: 400 }
      );
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (assignedTeam) updateData.assignedTeam = assignedTeam;

    const updated = await prisma.ticket.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err) {
    console.error('PATCH /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update ticket.' }, { status: 500 });
  }
}

// DELETE /api/tickets/[id] — admin only
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    if (user.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    await prisma.ticket.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true, message: 'Ticket deleted.' });
  } catch (err) {
    console.error('DELETE /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete ticket.' }, { status: 500 });
  }
}
