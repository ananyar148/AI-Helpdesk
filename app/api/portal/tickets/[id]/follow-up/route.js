/**
 * POST /api/portal/tickets/[id]/follow-up
 * Client adds a follow-up message to an existing ticket.
 * Logs it as a FOLLOW_UP_ADDED activity on the original ticket — no new ticket created.
 */

import { NextResponse } from 'next/server';
import prisma           from '../../../../../../lib/prisma';
import { logActivity, buildDetail, ACTIONS } from '../../../../../../lib/activity';

export async function POST(request, { params }) {
  try {
    const { id }  = await params;
    const body    = await request.json();
    const { clientEmail, message } = body;

    if (!message?.trim() || message.trim().length < 5) {
      return NextResponse.json({ error: 'Message must be at least 5 characters.' }, { status: 400 });
    }
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json({ error: 'Valid client email is required.' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    const normalEmail = clientEmail.trim().toLowerCase();
    if (ticket.clientEmail?.toLowerCase() !== normalEmail) {
      return NextResponse.json({ error: 'Email does not match this ticket.' }, { status: 403 });
    }

    await logActivity({
      ticketId: id,
      action:   ACTIONS.FOLLOW_UP_ADDED,
      detail:   buildDetail.followUpAdded(normalEmail),
      newValue: message.trim(),
    });

    return NextResponse.json({ success: true, message: 'Follow-up added.' });
  } catch (err) {
    console.error('POST /api/portal/tickets/[id]/follow-up error:', err);
    return NextResponse.json({ error: 'Failed to add follow-up.' }, { status: 500 });
  }
}
