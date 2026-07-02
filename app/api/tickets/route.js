/**
 * /api/tickets
 * POST - Submit a new support ticket (public)
 * GET  - List tickets (protected; filtered by role/team)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { classifyTicket } from '../../../lib/classifier';
import { getUserFromRequest } from '../../../lib/auth';
import { logActivity, ACTIONS } from '../../../lib/activity';

// POST /api/tickets — public ticket submission (no auth required)
export async function POST(request) {
  try {
    const body = await request.json();
    const { subject, description } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { error: 'Subject and description are required.' },
        { status: 400 }
      );
    }
    if (subject.trim().length < 5) {
      return NextResponse.json(
        { error: 'Subject must be at least 5 characters.' },
        { status: 400 }
      );
    }
    if (description.trim().length < 10) {
      return NextResponse.json(
        { error: 'Description must be at least 10 characters.' },
        { status: 400 }
      );
    }

    // Near-duplicate detection: fetch last 200 tickets
    const recentTickets = await prisma.ticket.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, subject: true, description: true,
        category: true, assignedTeam: true, priority: true, draftResponse: true,
      },
    });

    const classification = await classifyTicket(
      subject.trim(),
      description.trim(),
      recentTickets
    );

    const ticket = await prisma.ticket.create({
      data: {
        subject:      subject.trim(),
        description:  description.trim(),
        category:     classification.category,
        assignedTeam: classification.assignedTeam,
        priority:     classification.priority,
        draftResponse:classification.draftResponse || null,
        status:       'Open',
      },
    });

    // Log creation + AI draft
    await logActivity({
      ticketId: ticket.id,
      action:   ACTIONS.CREATED,
      detail:   `Ticket submitted by client. AI classified as ${classification.category} → ${classification.assignedTeam} (source: ${classification.source})`,
    });

    if (ticket.draftResponse) {
      await logActivity({
        ticketId: ticket.id,
        action:   ACTIONS.AI_DRAFT_GENERATED,
        detail:   `AI draft response generated (source: ${classification.source})`,
      });
    }

    return NextResponse.json(
      { success: true, ticket, classificationSource: classification.source,
        message: 'Your ticket has been submitted successfully.' },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/tickets error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

// GET /api/tickets — protected
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const team     = searchParams.get('team');

    const where = {};

    // TeamMembers only see their own team's tickets
    if (user.role === 'TeamMember' && user.team) {
      where.assignedTeam = user.team;
    }

    if (status)                       where.status      = status;
    if (category)                     where.category    = category;
    if (priority)                     where.priority    = priority;
    if (team && user.role === 'Admin') where.assignedTeam = team;

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ tickets });
  } catch (err) {
    console.error('GET /api/tickets error:', err);
    return NextResponse.json({ error: 'Failed to fetch tickets.' }, { status: 500 });
  }
}
