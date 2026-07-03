/**
 * /api/tickets/check-duplicate
 * POST - Check if a new ticket is similar to existing open tickets.
 * Returns { isDuplicate, score, existingTicket } — no ticket is created here.
 */

import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { findBestMatch } from '../../../../lib/duplicate';
import { classifyTicket } from '../../../../lib/classifier';

export async function POST(request) {
  try {
    const body = await request.json();
    const { subject, description } = body;

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'Subject and description are required.' },
        { status: 400 }
      );
    }

    // Pre-classify so we can use category/team in the similarity signal
    const recentTickets = await prisma.ticket.findMany({
      take: 200,
      where: { status: { in: ['Open', 'In Progress'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, subject: true, description: true,
        category: true, assignedTeam: true, priority: true,
        draftResponse: true, status: true,
      },
    });

    // Quick keyword classification for the category/team signal
    const classification = await classifyTicket(
      subject.trim(),
      description.trim(),
      [] // don't reuse here — we want raw classification for comparison
    );

    const newTicketData = {
      subject:      subject.trim(),
      description:  description.trim(),
      category:     classification.category,
      assignedTeam: classification.assignedTeam,
    };

    const { match, score, shouldWarn } = findBestMatch(newTicketData, recentTickets);

    if (shouldWarn && match) {
      return NextResponse.json({
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
        // Pass pre-computed classification back so client can skip Gemini
        classification,
      });
    }

    return NextResponse.json({
      isDuplicate:    false,
      score:          Math.round(score * 100),
      existingTicket: null,
      classification,
    });
  } catch (err) {
    console.error('POST check-duplicate error:', err);
    return NextResponse.json({ error: 'Failed to check for duplicates.' }, { status: 500 });
  }
}
