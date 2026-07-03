/**
 * /api/tickets/[id]
 * GET    - Fetch ticket + activity log (protected)
 * PATCH  - Update status / team / priority (TeamMember own team | Admin all)
 * DELETE - Delete ticket (TeamMember own team | Admin all)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { logActivity, buildDetail, ACTIONS } from '../../../../lib/activity';

// GET /api/tickets/[id]
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { activities: { orderBy: { createdAt: 'asc' } } },
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

    if (user.role === 'TeamMember' && ticket.assignedTeam !== user.team) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
    if (assignedTeam && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can reassign tickets.' }, { status: 403 });
    }

    const validStatuses    = ['Open', 'In Progress', 'Resolved'];
    const validTeams       = ['Development', 'Billing', 'HR', 'Support'];
    const validPriorities  = ['Low', 'Medium', 'High'];

    if (status       && !validStatuses.includes(status))       return NextResponse.json({ error: `Invalid status.`   }, { status: 400 });
    if (assignedTeam && !validTeams.includes(assignedTeam))    return NextResponse.json({ error: `Invalid team.`     }, { status: 400 });
    if (priority     && !validPriorities.includes(priority))   return NextResponse.json({ error: `Invalid priority.` }, { status: 400 });

    const updateData = {};
    if (status)       updateData.status       = status;
    if (assignedTeam) updateData.assignedTeam = assignedTeam;
    if (priority)     updateData.priority     = priority;

    const updated = await prisma.ticket.update({ where: { id }, data: updateData });

    // ── Audit logs — include name + team in every entry ──
    if (status && status !== ticket.status) {
      await logActivity({
        ticketId: id,
        action:   ACTIONS.STATUS_UPDATED,
        detail:   buildDetail.statusUpdated(user, ticket.status, status),
        oldValue: ticket.status,
        newValue: status,
        actor:    user,
      });
    }
    if (assignedTeam && assignedTeam !== ticket.assignedTeam) {
      await logActivity({
        ticketId: id,
        action:   ACTIONS.TEAM_REASSIGNED,
        detail:   buildDetail.teamReassigned(user, ticket.assignedTeam, assignedTeam),
        oldValue: ticket.assignedTeam,
        newValue: assignedTeam,
        actor:    user,
      });
    }
    if (priority && priority !== ticket.priority) {
      await logActivity({
        ticketId: id,
        action:   ACTIONS.PRIORITY_CHANGED,
        detail:   buildDetail.priorityChanged(user, ticket.priority, priority),
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
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    if (user.role === 'TeamMember' && ticket.assignedTeam !== user.team) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    await logActivity({
      ticketId: id,
      action:   ACTIONS.TICKET_DELETED,
      detail:   buildDetail.ticketDeleted(user, ticket.subject),
      actor:    user,
    });

    await prisma.ticket.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Ticket deleted.' });
  } catch (err) {
    console.error('DELETE /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete ticket.' }, { status: 500 });
  }
}
