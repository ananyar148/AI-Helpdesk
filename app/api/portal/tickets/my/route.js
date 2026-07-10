/**
 * /api/portal/tickets/my
 * GET — Return all tickets belonging to the signed-in client.
 * Accepts BOTH NextAuth (Google) session AND client_token cookie (email/password).
 */

import { NextResponse }            from 'next/server';
import { getToken }                from 'next-auth/jwt';
import prisma                      from '../../../../../lib/prisma';
import { getClientFromRequest }    from '../../../../../lib/clientAuth';

export async function GET(request) {
  try {
    let email        = null;
    let clientUserId = null;

    // ── Try NextAuth (Google) first ───────────────────────────────────────────
    const nextAuthToken = await getToken({
      req:    request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (nextAuthToken?.email) {
      email        = nextAuthToken.email.toLowerCase();
      clientUserId = nextAuthToken.clientUserId ?? null;
    } else {
      // ── Fall back to client_token cookie (email/password login) ─────────────
      const clientUser = await getClientFromRequest(request);
      if (clientUser?.email) {
        email        = clientUser.email.toLowerCase();
        clientUserId = clientUser.id;
      }
    }

    if (!email) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    // Match by clientUserId OR clientEmail (covers tickets submitted before account creation)
    const where = clientUserId
      ? { OR: [{ clientUserId }, { clientEmail: email }] }
      : { clientEmail: email };

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id:             true,
        ticketNumber:   true,
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
            id: true, fileName: true, mimeType: true, sizeBytes: true, dataUrl: true, createdAt: true,
          },
        },
        activities: {
          where:   { action: { in: ['details_requested', 'details_provided', 'follow_up_added'] } },
          orderBy: { createdAt: 'asc' },
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
