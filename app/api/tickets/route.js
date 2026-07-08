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
import { findBestMatch } from '../../../lib/duplicate';
import {
  sendTicketCreatedClient,
  sendTicketCreatedAdmin,
} from '../../../lib/mailer';

// POST /api/tickets — public ticket submission
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      subject,
      description,
      clientEmail        = null,
      forceCreate        = false,
      duplicateOfId      = null,
      similarityScore    = null,
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
    // Validate email format if provided
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // ── Fetch active tickets for duplicate detection ───────────────────────────
    const recentTickets = await prisma.ticket.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, subject: true, description: true,
        category: true, assignedTeams: true, priority: true,
        draftResponse: true, status: true,
      },
    });

    // Normalise for duplicate/classifier helpers (they expect assignedTeam singular)
    const recentNorm = recentTickets.map((t) => ({
      ...t,
      assignedTeam: t.assignedTeams?.[0] || 'Support',
    }));

    // ── Classification ────────────────────────────────────────────────────────
    let classification;
    if (preClassification) {
      classification = preClassification;
    } else {
      const { match, score, shouldWarn } = findBestMatch(
        { subject: subject.trim(), description: description.trim(), category: '', assignedTeam: '' },
        recentNorm
      );

      if (shouldWarn && match && !forceCreate) {
        const original = recentTickets.find((t) => t.id === match.id);
        return NextResponse.json(
          {
            isDuplicate:    true,
            score:          Math.round(score * 100),
            existingTicket: {
              id:            original.id,
              subject:       original.subject,
              status:        original.status,
              category:      original.category,
              assignedTeams: original.assignedTeams,
              priority:      original.priority,
            },
          },
          { status: 409 }
        );
      }

      classification = await classifyTicket(subject.trim(), description.trim(), recentNorm);
    }

    // Classifier returns assignedTeam (singular) — wrap to array
    const assignedTeams = classification.assignedTeams
      ?? (classification.assignedTeam ? [classification.assignedTeam] : ['Support']);

    // ── Create ticket ─────────────────────────────────────────────────────────
    const ticket = await prisma.ticket.create({
      data: {
        subject:         subject.trim(),
        description:     description.trim(),
        clientEmail:     clientEmail ? clientEmail.trim().toLowerCase() : null,
        category:        classification.category,
        assignedTeams,
        priority:        classification.priority,
        draftResponse:   classification.draftResponse || null,
        status:          'Open',
        isDuplicate:     forceCreate && !!duplicateOfId,
        duplicateOfId:   forceCreate && duplicateOfId ? duplicateOfId : null,
        similarityScore: forceCreate && similarityScore ? similarityScore / 100 : null,
      },
    });

    await logActivity({
      ticketId: ticket.id,
      action:   ACTIONS.CREATED,
      detail:   buildDetail.ticketCreated(classification.category, assignedTeams, classification.source),
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

    // ── Send emails (non-blocking — failures won't break the response) ────────
    const emailClient = clientEmail?.trim().toLowerCase() || null;
    console.log(`[tickets route] About to send creation emails | ticketId: ${ticket.id} | emailClient: ${emailClient ?? 'none'} | ADMIN_EMAIL set: ${!!process.env.ADMIN_EMAIL} | SMTP_USER set: ${!!process.env.SMTP_USER}`);
    await Promise.allSettled([
      sendTicketCreatedClient(ticket, emailClient),
      sendTicketCreatedAdmin(ticket, emailClient),
    ]);
    console.log(`[tickets route] Creation emails settled`);

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
    const status   = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const team     = searchParams.get('team');

    const where = {};

    // TeamMembers see only tickets where their team appears in assignedTeams
    if (user.role === 'TeamMember' && user.team) {
      where.assignedTeams = { has: user.team };
    }

    if (status)                        where.status   = status;
    if (category)                      where.category = category;
    if (priority)                      where.priority = priority;
    if (team && user.role === 'Admin') where.assignedTeams = { has: team };

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
