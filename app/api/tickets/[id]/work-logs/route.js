/**
 * /api/tickets/[id]/work-logs
 * GET  - Fetch work logs (TeamMember sees Internal+Client; client sees Client only)
 * POST - Add a work log (TeamMember own team | Admin)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../lib/auth';
import { logActivity, buildDetail, ACTIONS } from '../../../../../lib/activity';

// GET /api/tickets/[id]/work-logs
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    const where = { ticketId: id };
    if (!user || (user.role === 'TeamMember' && ticket.assignedTeam !== user.team && user.role !== 'Admin')) {
      where.visibility = 'Client';
    }

    const workLogs = await prisma.ticketWorkLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ workLogs });
  } catch (err) {
    console.error('GET work-logs error:', err);
    return NextResponse.json({ error: 'Failed to fetch work logs.' }, { status: 500 });
  }
}

// POST /api/tickets/[id]/work-logs
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    if (user.role === 'TeamMember' && ticket.assignedTeam !== user.team) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const body = await request.json();
    const { note, visibility = 'Internal' } = body;

    if (!note || note.trim().length < 3) {
      return NextResponse.json({ error: 'Note must be at least 3 characters.' }, { status: 400 });
    }

    const validVisibilities = ['Internal', 'Client'];
    if (!validVisibilities.includes(visibility)) {
      return NextResponse.json({ error: 'Visibility must be Internal or Client.' }, { status: 400 });
    }

    const workLog = await prisma.ticketWorkLog.create({
      data: {
        ticketId:   id,
        userId:     user.id,
        userName:   user.name,
        userRole:   user.role,
        team:       user.team || null,
        note:       note.trim(),
        visibility,
      },
    });

    // Rich audit detail: "Ram (Development) added a internal work log"
    await logActivity({
      ticketId: id,
      action:   ACTIONS.WORK_LOG_ADDED,
      detail:   buildDetail.workLogAdded(user, visibility),
      actor:    user,
    });

    return NextResponse.json({ success: true, workLog }, { status: 201 });
  } catch (err) {
    console.error('POST work-logs error:', err);
    return NextResponse.json({ error: 'Failed to add work log.' }, { status: 500 });
  }
}
