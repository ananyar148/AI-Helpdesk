/**
 * /api/tickets/[id]
 * GET    - Fetch ticket + activity log (protected)
 * PATCH  - Update status / assignedTeams / priority (TeamMember own team | Admin all)
 * DELETE - Delete ticket (TeamMember own team | Admin all)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { logActivity, buildDetail, ACTIONS } from '../../../../lib/activity';
import {
  sendTicketResolvedClient,
  sendTicketResolvedAdmin,
  sendTicketResolvedResolver,
  sendChangeNotificationActor,
  sendTicketDeletedAdmin,
  sendTicketChangedAdmin,
  sendTicketAssigned,
} from '../../../../lib/mailer';

const VALID_TEAMS      = ['Development', 'Billing', 'HR', 'Support'];
const VALID_STATUSES   = ['Open', 'In Progress', 'Resolved'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];
const VALID_CATEGORIES = ['Bug', 'Feature Request', 'Billing', 'HR', 'Other'];

/** Returns true if the user can access this ticket */
function userCanAccessTicket(user, ticket) {
  if (user.role === 'Admin') return true;
  if (user.role === 'TeamMember') {
    // Individually assigned — only the assignee can access
    if (ticket.assignedToId) return ticket.assignedToId === user.id;
    // No individual assignment — anyone on the assigned team can access
    return user.team ? ticket.assignedTeams.includes(user.team) : false;
  }
  return false;
}

// GET /api/tickets/[id]
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        activities:  { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
        assignedTo:  { select: { id: true, name: true, email: true, team: true } },
      },
    });

    if (!ticket || ticket.deletedAt) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    if (!userCanAccessTicket(user, ticket)) {
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
    const { status, assignedTeams, priority, category, assignedToId } = body;

    const ticket = await prisma.ticket.findUnique({
      where:   { id },
      include: { assignedTo: { select: { id: true, name: true, email: true, team: true } } },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    if (!userCanAccessTicket(user, ticket)) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Only admins can change team assignments, individual assignment, or category
    if (assignedTeams && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can reassign teams.' }, { status: 403 });
    }
    if (assignedToId !== undefined && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can assign tickets to individuals.' }, { status: 403 });
    }
    if (category && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can change the category.' }, { status: 403 });
    }

    // Validate inputs
    if (status       && !VALID_STATUSES.includes(status))
      return NextResponse.json({ error: 'Invalid status.' },   { status: 400 });
    if (priority     && !VALID_PRIORITIES.includes(priority))
      return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });
    if (category     && !VALID_CATEGORIES.includes(category))
      return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
    if (assignedTeams) {
      if (!Array.isArray(assignedTeams) || assignedTeams.length === 0)
        return NextResponse.json({ error: 'assignedTeams must be a non-empty array.' }, { status: 400 });
      const invalid = assignedTeams.filter((t) => !VALID_TEAMS.includes(t));
      if (invalid.length)
        return NextResponse.json({ error: `Invalid team(s): ${invalid.join(', ')}` }, { status: 400 });
    }

    const updateData = {};
    if (status)        updateData.status        = status;
    if (assignedTeams) updateData.assignedTeams = assignedTeams;
    if (priority)      updateData.priority      = priority;
    if (category)      updateData.category      = category;

    // Validate assignedToId — must be an active TeamMember if provided
    let newAssignee = null;
    if (assignedToId !== undefined) {
      if (assignedToId === null) {
        // Explicit null = unassign
        updateData.assignedToId = null;
      } else {
        newAssignee = await prisma.user.findUnique({
          where:  { id: assignedToId },
          select: { id: true, name: true, email: true, role: true, team: true, isActive: true },
        });
        if (!newAssignee || !newAssignee.isActive) {
          return NextResponse.json({ error: 'Assignee not found or inactive.' }, { status: 400 });
        }
        updateData.assignedToId = assignedToId;
      }
    }

    const updated = await prisma.ticket.update({
      where:   { id },
      data:    updateData,
      include: { assignedTo: { select: { id: true, name: true, email: true, team: true } } },
    });

    // ── Audit logs ────────────────────────────────────────────────────────────
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

    if (assignedTeams) {
      const oldTeams = ticket.assignedTeams;
      const added    = assignedTeams.filter((t) => !oldTeams.includes(t));
      const removed  = oldTeams.filter((t) => !assignedTeams.includes(t));

      if (added.length || removed.length) {
        await logActivity({
          ticketId: id,
          action:   ACTIONS.TEAMS_UPDATED,
          detail:   buildDetail.teamsUpdated(user, added, removed),
          oldValue: oldTeams.join(', '),
          newValue: assignedTeams.join(', '),
          actor:    user,
        });
      }
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

    if (category && category !== ticket.category) {
      await logActivity({
        ticketId: id,
        action:   ACTIONS.CATEGORY_CHANGED,
        detail:   buildDetail.categoryChanged(user, ticket.category, category),
        oldValue: ticket.category,
        newValue: category,
        actor:    user,
      });
    }

    if (assignedToId !== undefined && assignedToId !== ticket.assignedToId) {
      if (assignedToId === null) {
        await logActivity({
          ticketId: id,
          action:   ACTIONS.ASSIGNED_TO,
          detail:   buildDetail.unassigned(user),
          oldValue: ticket.assignedTo?.name ?? null,
          newValue: null,
          actor:    user,
        });
      } else if (newAssignee) {
        await logActivity({
          ticketId: id,
          action:   ACTIONS.ASSIGNED_TO,
          detail:   buildDetail.assignedTo(user, newAssignee.name),
          oldValue: ticket.assignedTo?.name ?? null,
          newValue: newAssignee.name,
          actor:    user,
        });
        // Notify the newly assigned person
        await sendTicketAssigned(updated, newAssignee, user);
      }
    }

    // ── Email notifications ───────────────────────────────────────────────────
    // Build a list of what changed for the actor confirmation email
    const changes = [];
    if (status && status !== ticket.status) {
      changes.push({ label: 'Status', from: ticket.status, to: status });
    }
    if (priority && priority !== ticket.priority) {
      changes.push({ label: 'Priority', from: ticket.priority, to: priority });
    }
    if (category && category !== ticket.category) {
      changes.push({ label: 'Category', from: ticket.category, to: category });
    }
    if (assignedTeams) {
      const added   = assignedTeams.filter((t) => !ticket.assignedTeams.includes(t));
      const removed = ticket.assignedTeams.filter((t) => !assignedTeams.includes(t));
      if (added.length || removed.length) {
        changes.push({
          label: 'Teams',
          from:  ticket.assignedTeams.join(', '),
          to:    assignedTeams.join(', '),
        });
      }
    }

    if (changes.length > 0) {
      const isResolving = status === 'Resolved' && ticket.status !== 'Resolved';

      if (isResolving) {
        // Ticket resolved → client + admin + resolver all get emails
        await Promise.allSettled([
          sendTicketResolvedClient(updated),
          sendTicketResolvedAdmin(updated, user),
          sendTicketResolvedResolver(updated, user),
        ]);
      } else {
        // Non-resolve change → actor confirmation + admin notification (if actor is TeamMember)
        await Promise.allSettled([
          sendChangeNotificationActor(updated, user, changes),
          sendTicketChangedAdmin(updated, user, changes),
        ]);
      }
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

    if (!userCanAccessTicket(user, ticket)) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Only admins can delete tickets
    if (user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can delete tickets.' }, { status: 403 });
    }

    await logActivity({
      ticketId: id,
      action:   ACTIONS.TICKET_DELETED,
      detail:   buildDetail.ticketDeleted(user, ticket.subject),
      actor:    user,
    });

    // Notify admin before soft-deleting (we need ticket data for the email)
    await sendTicketDeletedAdmin(ticket, user);

    // Soft delete — set deletedAt instead of removing from DB
    await prisma.ticket.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Ticket deleted.' });
  } catch (err) {
    console.error('DELETE /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete ticket.' }, { status: 500 });
  }
}
