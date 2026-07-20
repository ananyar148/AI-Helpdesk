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
  sendTicketResolvedByTeam,
  sendTicketSignedOff,
  sendTicketReopened,
} from '../../../../lib/mailer';

const VALID_TEAMS      = ['Development', 'Billing', 'HR', 'Support'];
const VALID_STATUSES   = ['Open', 'In Progress', 'Resolved', 'Signed Off'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];
const VALID_CATEGORIES = ['Bug', 'Feature Request', 'Billing', 'HR', 'Other', 'Out of Scope'];

/** Returns true if the user can access this ticket */
function userCanAccessTicket(user, ticket) {
  if (user.role === 'Admin') return true;
  if (user.role === 'TeamMember') {
    // Individually assigned — only assignees can access
    if (ticket.assignees?.length > 0) {
      return ticket.assignees.some(a => a.userId === user.id);
    }
    // No individual assignees — anyone on the assigned team can access
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
        assignees:   { include: { user: { select: { id: true, name: true, email: true, team: true } } } },
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
    const { status, assignedTeams, priority, category, assignedUserIds } = body;

    const ticket = await prisma.ticket.findUnique({
      where:   { id },
      include: { assignees: { include: { user: { select: { id: true, name: true, email: true, team: true } } } } },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    if (!userCanAccessTicket(user, ticket)) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Only admins can change team assignments, individual assignment, or category
    if (assignedTeams && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can reassign teams.' }, { status: 403 });
    }
    if (assignedUserIds !== undefined && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can assign tickets to individuals.' }, { status: 403 });
    }
    if (category && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can change the category.' }, { status: 403 });
    }
    // TeamMembers AND Admins can only change normal status (Open/In Progress/Resolved)
    // on tickets assigned to them.
    // Exception 1: Admin can sign off any Resolved ticket, and reopen any Signed Off ticket.
    // Exception 2: Admin can directly resolve Out of Scope tickets without assignment.
    const NORMAL_STATUSES = new Set(['Open', 'In Progress', 'Resolved']);
    if (status && NORMAL_STATUSES.has(status) && ticket.status !== 'Signed Off') {
      const isOutOfScope = ticket.category === 'Out of Scope' || category === 'Out of Scope';
      const isAdminResolvingOutOfScope = user.role === 'Admin' && status === 'Resolved' && isOutOfScope;

      if (!isAdminResolvingOutOfScope) {
        const isAssigned = ticket.assignees?.some(a => a.userId === user.id);
        if (!isAssigned) {
          const who = user.role === 'Admin' ? 'Admins' : 'Team members';
          return NextResponse.json({ error: `${who} can only change the status of tickets assigned to them.` }, { status: 403 });
        }
      }
    }
    // Only admins can sign off a ticket, and only when it's Resolved
    if (status === 'Signed Off' && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can sign off tickets.' }, { status: 403 });
    }
    if (status === 'Signed Off' && ticket.status !== 'Resolved') {
      return NextResponse.json({ error: 'Only Resolved tickets can be signed off.' }, { status: 400 });
    }
    // A Signed Off ticket can only be reopened by an admin
    if (ticket.status === 'Signed Off' && status && status !== 'Signed Off' && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only admins can reopen a signed-off ticket.' }, { status: 403 });
    }
    if (ticket.status === 'Signed Off' && status === 'Resolved') {
      return NextResponse.json({ error: 'Cannot change a signed-off ticket back to Resolved.' }, { status: 400 });
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

    // Handle multi-assignee via join table
    let newAssignees = null;
    if (assignedUserIds !== undefined) {
      if (!Array.isArray(assignedUserIds)) {
        return NextResponse.json({ error: 'assignedUserIds must be an array.' }, { status: 400 });
      }
      // Validate all user IDs exist and are active
      if (assignedUserIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: assignedUserIds }, isActive: true },
          select: { id: true, name: true, email: true, team: true },
        });
        if (users.length !== assignedUserIds.length) {
          return NextResponse.json({ error: 'One or more assignees not found or inactive.' }, { status: 400 });
        }
        newAssignees = users;
      } else {
        newAssignees = [];
      }
      // Replace assignees via connect/disconnect
      updateData.assignees = {
        deleteMany: {},
        create: assignedUserIds.map(uid => ({ userId: uid })),
      };
    }

    const updated = await prisma.ticket.update({
      where:   { id },
      data:    updateData,
      include: { assignees: { include: { user: { select: { id: true, name: true, email: true, team: true } } } } },
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

    if (assignedUserIds !== undefined && newAssignees !== null) {
      const oldNames = (ticket.assignees || []).map(a => a.user?.name).filter(Boolean).join(', ') || 'None';
      const newNames = newAssignees.map(u => u.name).join(', ') || 'None';
      if (oldNames !== newNames) {
        await logActivity({
          ticketId: id,
          action:   ACTIONS.ASSIGNED_TO,
          detail:   newAssignees.length === 0
            ? buildDetail.unassigned(user)
            : buildDetail.assignedTo(user, newNames),
          oldValue: oldNames,
          newValue: newNames,
          actor:    user,
        });
        // Email all newly added assignees
        const oldIds = (ticket.assignees || []).map(a => a.userId);
        const addedAssignees = newAssignees.filter(u => !oldIds.includes(u.id));
        await Promise.allSettled(addedAssignees.map(a => sendTicketAssigned(updated, a, user)));
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
      const prevStatus    = ticket.status;
      const isResolving   = status === 'Resolved'   && prevStatus !== 'Resolved';
      const isSigningOff  = status === 'Signed Off' && prevStatus !== 'Signed Off';
      const isReopening   = status === 'Open'       && (prevStatus === 'Signed Off' || prevStatus === 'Resolved');

      if (isSigningOff) {
        // Find the team member who last resolved the ticket (from activity log)
        const resolveActivity = await prisma.ticketActivity.findFirst({
          where:   { ticketId: id, action: 'status_updated', newValue: 'Resolved' },
          orderBy: { createdAt: 'desc' },
        });
        const resolverInfo = resolveActivity?.userId
          ? await prisma.user.findUnique({ where: { id: resolveActivity.userId }, select: { id: true, name: true, email: true, team: true, role: true } })
          : null;

        await logActivity({
          ticketId: id,
          action:   ACTIONS.SIGNED_OFF,
          detail:   buildDetail.signedOff(user),
          oldValue: prevStatus,
          newValue: 'Signed Off',
          actor:    user,
        });
        await sendTicketSignedOff(updated, user, resolverInfo);

      } else if (isReopening) {
        await logActivity({
          ticketId: id,
          action:   ACTIONS.REOPENED,
          detail:   buildDetail.reopened(user),
          oldValue: prevStatus,
          newValue: 'Open',
          actor:    user,
        });
        await sendTicketReopened(updated, user);

      } else if (isResolving) {
        if (user.role === 'TeamMember') {
          // TeamMember resolves → notify admin + resolver only (NOT client)
          await sendTicketResolvedByTeam(updated, user);
        } else {
          // Admin resolves directly → treat as sign-off equivalent: notify all
          await Promise.allSettled([
            sendTicketResolvedClient(updated),
            sendTicketResolvedAdmin(updated, user),
            sendTicketResolvedResolver(updated, user),
          ]);
        }
      } else {
        // Non-status changes or status change that isn't a key workflow step
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
