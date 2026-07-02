/**
 * /api/tickets/[id]
 * GET    - Fetch ticket + activity log (protected)
 * PATCH  - Update status or team (TeamMember own team | Admin all)
 * DELETE - Delete ticket (TeamMember own team | Admin all)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { logActivity, ACTIONS } from '../../../../lib/activity';

// GET /api/tickets/[id]  — returns ticket + activities
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    if (user.role === 'TeamMember' && ticket.assignedTeam !== user.team) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error('GET /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch ticket.' }, { status: 500 });
  }
}

// PATCH /api/tickets/[id]
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const body = await request.json();
    const { status, assignedTeam, priority } = body;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    // TeamMember can only touch their own team's tickets
    if (user.role === 'TeamMember' && ticket.assignedTeam !== user.team) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Only admins can reassign
    if (assignedTeam && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can reassign tickets.' }, { status: 403 });
    }

    const validStatuses = ['Open', 'In Progress', 'Resolved'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const validTeams = ['Development', 'Billing', 'HR', 'Support'];
    if (assignedTeam && !validTeams.includes(assignedTeam)) {
      return NextResponse.json(
        { error: `Invalid team. Must be one of: ${validTeams.join(', ')}` },
        { status: 400 }
      );
    }

    const validPriorities = ['Low', 'Medium', 'High'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    const updateData = {};
    if (status)       updateData.status       = status;
    if (assignedTeam) updateData.assignedTeam = assignedTeam;
    if (priority)     updateData.priority     = priority;

    const updated = await prisma.ticket.update({ where: { id }, data: updateData });

    // Log each change separately for a clean timeline
    if (status && status !== ticket.status) {
      await logActivity({
        ticketId: id,
        action:   ACTIONS.STATUS_UPDATED,
        detail:   `Status changed from "${ticket.status}" to "${status}"`,
        oldValue: ticket.status,
        newValue: status,
        actor:    user,
      });
    }
    if (assignedTeam && assignedTeam !== ticket.assignedTeam) {
      await logActivity({
        ticketId: id,
        action:   ACTIONS.TEAM_REASSIGNED,
        detail:   `Ticket reassigned from ${ticket.assignedTeam} to ${assignedTeam}`,
        oldValue: ticket.assignedTeam,
        newValue: assignedTeam,
        actor:    user,
      });
    }
    if (priority && priority !== ticket.priority) {
      await logActivity({
        ticketId: id,
        action:   ACTIONS.PRIORITY_CHANGED,
        detail:   `Priority changed from "${ticket.priority}" to "${priority}"`,
        oldValue: ticket.priority,
        newValue: priority,
        actor:    user,
      });
    }

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err) {
    console.error('PATCH /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update ticket.' }, { status: 500 });
  }
}

// DELETE /api/tickets/[id]
// TeamMembers can delete tickets assigned to their own team.
// Admins can delete any ticket.
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    // TeamMembers can only delete their own team's tickets
    if (user.role === 'TeamMember' && ticket.assignedTeam !== user.team) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Log before deleting (Cascade will remove activity rows, so log separately)
    // We log the action then delete — the log itself gets cascade-deleted too,
    // which is fine; the intent was just audit trail while ticket exists.
    await logActivity({
      ticketId: id,
      action:   ACTIONS.TICKET_DELETED,
      detail:   `Ticket "${ticket.subject}" deleted by ${user.name} (${user.role})`,
      actor:    user,
    });

    await prisma.ticket.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Ticket deleted.' });
  } catch (err) {
    console.error('DELETE /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete ticket.' }, { status: 500 });
  }
}
