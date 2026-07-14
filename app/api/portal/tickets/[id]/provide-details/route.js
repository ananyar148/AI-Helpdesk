/**
 * POST /api/portal/tickets/[id]/provide-details
 * Client submits additional details (with optional images) in response to a team request.
 */

import { NextResponse } from 'next/server';
import prisma           from '../../../../../../lib/prisma';
import { logActivity, buildDetail, ACTIONS } from '../../../../../../lib/activity';

const MAX_ATTACHMENTS      = 25;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export async function POST(request, { params }) {
  try {
    const { id }  = await params;
    const body    = await request.json();
    const { clientEmail, details, attachments = [] } = body;

    if (!details?.trim() || details.trim().length < 5) {
      return NextResponse.json({ error: 'Details must be at least 5 characters.' }, { status: 400 });
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

    // Validate attachments
    if (attachments.length > MAX_ATTACHMENTS) {
      return NextResponse.json({ error: `Maximum ${MAX_ATTACHMENTS} images allowed.` }, { status: 400 });
    }
    for (const att of attachments) {
      if (!att.mimeType?.startsWith('image/')) {
        return NextResponse.json({ error: 'Only image files are allowed.' }, { status: 400 });
      }
      if (att.sizeBytes > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: `"${att.fileName}" exceeds the 5 MB limit.` }, { status: 400 });
      }
    }

    // Save attachments to the ticket
    if (attachments.length > 0) {
      await prisma.ticketAttachment.createMany({
        data: attachments.map(a => ({
          ticketId:  id,
          fileName:  a.fileName,
          mimeType:  a.mimeType,
          dataUrl:   a.dataUrl,
          sizeBytes: a.sizeBytes,
        })),
      });
    }

    await logActivity({
      ticketId: id,
      action:   ACTIONS.DETAILS_PROVIDED,
      detail:   buildDetail.detailsProvided(normalEmail),
      newValue: details.trim(),
    });

    return NextResponse.json({ success: true, message: 'Details submitted successfully.' });
  } catch (err) {
    console.error('POST /api/portal/tickets/[id]/provide-details error:', err);
    return NextResponse.json({ error: 'Failed to submit details.' }, { status: 500 });
  }
}
