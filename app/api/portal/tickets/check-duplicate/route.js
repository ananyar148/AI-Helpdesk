/**
 * /api/portal/tickets/check-duplicate
 * POST - Duplicate check for the client portal (no auth required)
 */

import { NextResponse } from 'next/server';
import prisma           from '../../../../../lib/prisma';
import { findBestMatch }  from '../../../../../lib/duplicate';
import { classifyTicket } from '../../../../../lib/classifier';

export async function POST(request) {
  try {
    const body = await request.json();
    const { subject, description } = body;

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Subject and description are required.' }, { status: 400 });
    }

    const recentTickets = await prisma.ticket.findMany({
      take: 200,
      where: { status: { in: ['Open', 'In Progress'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, subject: true, description: true, category: true, assignedTeams: true, priority: true, draftResponse: true, status: true },
    });

    const recentNorm = recentTickets.map((t) => ({ ...t, assignedTeam: t.assignedTeams?.[0] || 'Support' }));
    const classification = await classifyTicket(subject.trim(), description.trim(), []);

    const { match, score, shouldWarn } = findBestMatch(
      { subject: subject.trim(), description: description.trim(), category: classification.category, assignedTeam: classification.assignedTeam || 'Support' },
      recentNorm
    );

    if (shouldWarn && match) {
      const original = recentTickets.find((t) => t.id === match.id);
      return NextResponse.json({
        isDuplicate: true, score: Math.round(score * 100),
        existingTicket: { id: original.id, subject: original.subject, status: original.status },
        classification,
      });
    }

    return NextResponse.json({ isDuplicate: false, score: Math.round(score * 100), existingTicket: null, classification });
  } catch (err) {
    console.error('Portal check-duplicate error:', err);
    return NextResponse.json({ error: 'Failed to check for duplicates.' }, { status: 500 });
  }
}
