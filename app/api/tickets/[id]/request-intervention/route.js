/**
 * POST /api/tickets/[id]/request-intervention
 * Team member sends an intervention request to the admin or a specific team member.
 * Accessible to any user who can access the ticket.
 */

import { NextResponse }              from 'next/server';
import prisma                        from '../../../../../lib/prisma';
import { getUserFromRequest }        from '../../../../../lib/auth';
import { sendInterventionRequest }   from '../../../../../lib/mailer';
import { logActivity, buildDetail, ACTIONS } from '../../../../../lib/activity';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const user   = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const { recipientId, message } = await request.json();

    if (!recipientId) {
      return NextResponse.json({ error: 'Recipient is required.' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where:   { id },
      include: { assignees: true },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    // Find the recipient
    const recipient = await prisma.user.findUnique({
      where:  { id: recipientId },
      select: { id: true, name: true, email: true, role: true, team: true, isActive: true },
    });
    if (!recipient || !recipient.isActive) {
      return NextResponse.json({ error: 'Recipient not found or inactive.' }, { status: 400 });
    }

    // Send the email
    const result = await sendInterventionRequest(ticket, user, recipient, message?.trim() || null);
    if (!result.sent) {
      return NextResponse.json({ error: 'Failed to send email. Check SMTP configuration.' }, { status: 500 });
    }

    // Log the activity
    await logActivity({
      ticketId: id,
      action:   'intervention_requested',
      detail:   `${user.name} (${user.team || user.role}) requested intervention from ${recipient.name}${message ? `: "${message.trim()}"` : ''}`,
      newValue: recipient.name,
      actor:    user,
    });

    return NextResponse.json({ success: true, message: `Intervention request sent to ${recipient.name}.` });
  } catch (err) {
    console.error('POST /api/tickets/[id]/request-intervention error:', err);
    return NextResponse.json({ error: 'Failed to send intervention request.' }, { status: 500 });
  }
}
