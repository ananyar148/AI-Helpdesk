/**
 * /api/tickets
 * POST - Submit a new support ticket (public)
 * GET  - List tickets (protected; filtered by role/team)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { classifyTicket } from '../../../lib/classifier';
import { getUserFromRequest } from '../../../lib/auth';
import { logActivity, buildDetail, ACTIONS } from '../../../lib/activity';
import { findBestMatch, DUPLICATE_REUSE_THRESHOLD } from '../../../lib/duplicate';

// POST /api/tickets — public ticket submission
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      subject,
      description,
      // Optional: client passes these when they clicked "Create Anyway" after duplicate warning
      forceCreate        = false,
      duplicateOfId      = null,
      similarityScore    = null,
      // Optional: pre-computed classification passed from check-duplicate to avoid Gemini re-call
      preClassification  = null,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────
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

    // ── Fetch active tickets for duplicate detection ───────────────────────────
    const recentTickets = await prisma.ticket.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, subject: true, description: true,
        category: true, assignedTeam: true, priority: true,
        draftResponse: true, status: true,
      },
    });

    // ── Classification ────────────────────────────────────────────────────────
    // If a pre-computed classification was passed (from check-duplicate), use it
    // to avoid calling Gemini again.
    let classification;
    if (preClassification) {
      classification = preClassification;
    } else {
      // Check for near-duplicate first, then classify
      const { match, score, shouldWarn } = findBestMatch(
        { subject: subject.trim(), description: description.trim(), category: '', assignedTeam: '' },
        recentTickets
      );

      // If high-similarity duplicate exists and user hasn't forced creation, warn them
      if (shouldWarn && match && !forceCreate) {
        return NextResponse.json(
          {
            isDuplicate:    true,
            score:          Math.round(score * 100),
            existingTicket: {
              id:           match.id,
              subject:      match.subject,
              status:       match.status,
              category:     match.category,
              assignedTeam: match.assignedTeam,
              priority:     match.priority,
            },
          },
          { status: 409 } // 409 Conflict = duplicate warning
        );
      }

      classification = await classifyTicket(
        subject.trim(),
        description.trim(),
        recentTickets
      );
    }

    // ── Create ticket ─────────────────────────────────────────────────────────
    const ticket = await prisma.ticket.create({
      data: {
        subject:        subject.trim(),
        description:    description.trim(),
        category:       classification.category,
        assignedTeam:   classification.assignedTeam,
        priority:       classification.priority,
        draftResponse:  classification.draftResponse || null,
        status:         'Open',
        isDuplicate:    forceCreate && !!duplicateOfId,
        duplicateOfId:  forceCreate && duplicateOfId ? duplicateOfId : null,
        similarityScore:forceCreate && similarityScore ? similarityScore / 100 : null,
      },
    });

    await logActivity({
      ticketId: ticket.id,
      action:   ACTIONS.CREATED,
      detail:   buildDetail.ticketCreated(classification.category, classification.assignedTeam, classification.source),
    });

    if (ticket.draftResponse) {
      await logActivity({
        ticketId: ticket.id,
        action:   ACTIONS.AI_DRAFT_GENERATED,
        detail:   buildDetail.aiDraftGenerated(classification.source),
      });
    }

    if (ticket.isDuplicate && ticket.duplicateOfId) {
      await logActivity({
        ticketId: ticket.id,
        action:   ACTIONS.DUPLICATE_DETECTED,
        detail:   `Submitted as duplicate of ticket ${ticket.duplicateOfId} (similarity: ${similarityScore}%)`,
        newValue: ticket.duplicateOfId,
      });
    }

    return NextResponse.json(
      {
        success:              true,
        ticket,
        classificationSource: classification.source,
        message:              'Your ticket has been submitted successfully.',
      },
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
    const status    = searchParams.get('status');
    const category  = searchParams.get('category');
    const priority  = searchParams.get('priority');
    const team      = searchParams.get('team');

    const where = {};

    if (user.role === 'TeamMember' && user.team) {
      where.assignedTeam = user.team;
    }

    if (status)                        where.status       = status;
    if (category)                      where.category     = category;
    if (priority)                      where.priority     = priority;
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
