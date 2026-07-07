/**
 * /api/portal/tickets/my
 * GET — Return all tickets belonging to the signed-in Google client.
 */

import { NextResponse } from 'next/server';
import { getToken }     from 'next-auth/jwt';
import prisma           from '../../../../../lib/prisma';

export async function GET(request) {
  try {
    const token = await getToken({
      req:    request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.email) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const email        = token.email.toLowerCase();
    const clientUserId = token.clientUserId ?? null;

    // Match by Google-linked clientUserId OR by email (covers tickets submitted
    // anonymously with the same email before the client had a Google account).
    let where;
    if (clientUserId) {
      where = { OR: [{ clientUserId }, { clientEmail: email }] };
    } else {
      where = { clientEmail: email };
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id:             true,
        subject:        true,
        description:    true,
        status:         true,
        category:       true,
        priority:       true,
        createdAt:      true,
        updatedAt:      true,
        parentTicketId: true,
        draftResponse:  true,
        attachments: {
          select: {
            id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true,
          },
        },
        activities: {
          where:   { action: 'details_requested' },
          orderBy: { createdAt: 'desc' },
          select:  { id: true, action: true, detail: true, newValue: true, createdAt: true, userName: true, userTeam: true },
        },
      },
    });

    return NextResponse.json({ tickets });
  } catch (err) {
    console.error('GET /api/portal/tickets/my error:', err);
    return NextResponse.json({ error: 'Failed to fetch your tickets.' }, { status: 500 });
  }
}
