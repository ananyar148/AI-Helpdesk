/**
 * POST /api/portal/tickets/[id]/provide-details
 * Called from the client portal when a client submits additional details
 * in response to a "request more details" from the team.
 * Logs a DETAILS_PROVIDED activity entry on the ticket.
 * No auth session required — identified by clientEmail in request body.
 */

import { NextResponse } from 'next/server';
import prisma           from '../../../../../../lib/prisma';
import { logActivity, buildDetail, ACTIONS } from '../../../../../../lib/activity';

export async function POST(request, { params }) {
  try {
    const { id }  = await params;
    const body    = await request.json();
    const { clientEmail, details } = body;

    if (!details?.trim() || details.trim().length < 5) {
      return NextResponse.json({ error: 'Details must be at least 5 characters.' }, { status: 400 });
    }
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json({ error: 'Valid client email is required.' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    // Verify the email matches the ticket's clientEmail
    const normalEmail = clientEmail.trim().toLowerCase();
    if (ticket.clientEmail?.toLowerCase() !== normalEmail) {
      return NextResponse.json({ error: 'Email does not match this ticket.' }, { status: 403 });
    }

    await logActivity({
      ticketId: id,
      action:   ACTIONS.DETAILS_PROVIDED,
      detail:   buildDetail.detailsProvided(normalEmail),
      newValue: details.trim(),   // store the client's message
    });

    return NextResponse.json({ success: true, message: 'Details submitted successfully.' });
  } catch (err) {
    console.error('POST /api/portal/tickets/[id]/provide-details error:', err);
    return NextResponse.json({ error: 'Failed to submit details.' }, { status: 500 });
  }
}
