/**
 * POST /api/tickets/[id]/request-details
 * Sends a "we need more details" email to the client and logs the activity.
 * Accessible to TeamMembers (assigned team) and Admins.
 */

import { NextResponse }  from 'next/server';
import prisma            from '../../../../../lib/prisma';
import { getUserFromRequest }           from '../../../../../lib/auth';
import { logActivity, buildDetail, ACTIONS } from '../../../../../lib/activity';
import { sendDetailsRequestedClient }   from '../../../../../lib/mailer';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const user   = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const body    = await request.json();
    const message = body.message?.trim();

    if (!message || message.length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters.' },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    // Access control
    if (
      user.role === 'TeamMember' &&
      (!user.team || !ticket.assignedTeams.includes(user.team))
    ) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const clientEmail = ticket.clientEmail;
    if (!clientEmail) {
      return NextResponse.json(
        { error: 'This ticket has no client email address on file.' },
        { status: 422 }
      );
    }

    // Send email
    console.log(`[request-details route] About to call sendDetailsRequestedClient | ticketId: ${id} | clientEmail: ${clientEmail} | actor: ${user?.email}`);
    await sendDetailsRequestedClient(ticket, clientEmail, message, user);
    console.log(`[request-details route] sendDetailsRequestedClient returned`);

    // Log the activity
    const activity = await logActivity({
      ticketId: id,
      action:   ACTIONS.DETAILS_REQUESTED,
      detail:   buildDetail.detailsRequested(user, clientEmail),
      newValue: message,   // store the message text in newValue so the timeline can show it
      actor:    user,
    });

    return NextResponse.json({
      success: true,
      message: `Details request sent to ${clientEmail}.`,
    });
  } catch (err) {
    console.error('POST /api/tickets/[id]/request-details error:', err);
    return NextResponse.json({ error: 'Failed to send request.' }, { status: 500 });
  }
}
