/**
 * /api/portal/tickets
 * GET  ?email=x — fetch all tickets submitted with that email (public, rate-limited by obscurity)
 * POST          — submit a new ticket or follow-up from the client portal
 */

import { NextResponse }    from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '../../../../lib/authOptions';
import prisma               from '../../../../lib/prisma';
import { classifyTicket }            from '../../../../lib/classifier';
import { logActivity, buildDetail, ACTIONS } from '../../../../lib/activity';
import { findBestMatch }             from '../../../../lib/duplicate';
import { sendTicketCreatedClient, sendTicketCreatedAdmin } from '../../../../lib/mailer';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ATTACHMENTS      = 3;

// GET /api/portal/tickets?email=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email')?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const tickets = await prisma.ticket.findMany({
      where:   { clientEmail: email },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, subject: true, description: true,
        status: true, createdAt: true, updatedAt: true,
        parentTicketId: true, draftResponse: true,
        attachments: {
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
        },
        activities: {
          where:   { action: 'details_requested' },
          orderBy: { createdAt: 'desc' },
          select:  { id: true, action: true, detail: true, newValue: true, createdAt: true, userName: true, userTeam: true },
        },
      },
    });

    return NextResponse.json({ tickets, email });
  } catch (err) {
    console.error('GET /api/portal/tickets error:', err);
    return NextResponse.json({ error: 'Failed to fetch tickets.' }, { status: 500 });
  }
}

// POST /api/portal/tickets
export async function POST(request) {
  try {
    // Extract clientUserId from NextAuth session (if signed in via Google)
    const session      = await getServerSession(authOptions);
    const clientUserId = session?.clientUserId ?? null;

    const body = await request.json();
    const {
      subject,
      description,
      clientEmail,
      parentTicketId   = null,
      forceCreate      = false,
      duplicateOfId    = null,
      similarityScore  = null,
      preClassification = null,
      attachments      = [],
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Subject and description are required.' }, { status: 400 });
    }
    if (subject.trim().length < 5) {
      return NextResponse.json({ error: 'Subject must be at least 5 characters.' }, { status: 400 });
    }
    if (description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters.' }, { status: 400 });
    }
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    // Validate attachments
    if (attachments.length > MAX_ATTACHMENTS) {
      return NextResponse.json({ error: `Maximum ${MAX_ATTACHMENTS} attachments allowed.` }, { status: 400 });
    }
    for (const att of attachments) {
      if (!att.mimeType?.startsWith('image/')) {
        return NextResponse.json({ error: 'Only image files are allowed.' }, { status: 400 });
      }
      if (att.sizeBytes > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: `"${att.fileName}" exceeds the 5 MB limit.` }, { status: 400 });
      }
    }

    const normalEmail = clientEmail.trim().toLowerCase();

    // ── Classification ────────────────────────────────────────────────────────
    let classification = preClassification;

    if (!classification) {
      if (parentTicketId) {
        // Follow-up: inherit parent's classification
        const parent = await prisma.ticket.findUnique({ where: { id: parentTicketId } });
        if (!parent) return NextResponse.json({ error: 'Parent ticket not found.' }, { status: 404 });
        if (parent.clientEmail !== normalEmail) {
          return NextResponse.json({ error: 'You can only follow up on your own tickets.' }, { status: 403 });
        }
        classification = {
          category:      parent.category,
          assignedTeams: parent.assignedTeams,
          assignedTeam:  parent.assignedTeams?.[0] || 'Support',
          priority:      parent.priority,
          draftResponse: null,
          source:        'follow-up',
        };
      } else {
        // New ticket: check for duplicates then classify
        const recentTickets = await prisma.ticket.findMany({
          take: 200,
          orderBy: { createdAt: 'desc' },
          select: { id: true, subject: true, description: true, category: true, assignedTeams: true, priority: true, draftResponse: true, status: true },
        });
        const recentNorm = recentTickets.map((t) => ({ ...t, assignedTeam: t.assignedTeams?.[0] || 'Support' }));

        const { match, score, shouldWarn } = findBestMatch(
          { subject: subject.trim(), description: description.trim(), category: '', assignedTeam: '' },
          recentNorm
        );

        if (shouldWarn && match && !forceCreate) {
          const original = recentTickets.find((t) => t.id === match.id);
          return NextResponse.json({
            isDuplicate: true, score: Math.round(score * 100),
            existingTicket: { id: original.id, subject: original.subject, status: original.status },
          }, { status: 409 });
        }

        classification = await classifyTicket(subject.trim(), description.trim(), recentNorm);
      }
    }

    const assignedTeams = classification.assignedTeams
      ?? (classification.assignedTeam ? [classification.assignedTeam] : ['Support']);

    // ── Create ticket ─────────────────────────────────────────────────────────
    const ticket = await prisma.ticket.create({
      data: {
        subject:         subject.trim(),
        description:     description.trim(),
        clientEmail:     normalEmail,
        clientUserId:    clientUserId || null,
        parentTicketId:  parentTicketId || null,
        category:        classification.category,
        assignedTeams,
        priority:        classification.priority,
        draftResponse:   classification.draftResponse || null,
        status:          'Open',
        isDuplicate:     forceCreate && !!duplicateOfId,
        duplicateOfId:   forceCreate && duplicateOfId ? duplicateOfId : null,
        similarityScore: forceCreate && similarityScore ? similarityScore / 100 : null,
        attachments: attachments.length > 0 ? {
          create: attachments.map((a) => ({
            fileName: a.fileName, mimeType: a.mimeType,
            dataUrl:  a.dataUrl,  sizeBytes: a.sizeBytes,
          })),
        } : undefined,
      },
      include: { attachments: true },
    });

    await logActivity({
      ticketId: ticket.id,
      action:   ACTIONS.CREATED,
      detail:   parentTicketId
        ? `Follow-up submitted by ${normalEmail} linked to ticket ${parentTicketId}`
        : buildDetail.ticketCreated(classification.category, assignedTeams, classification.source),
    });

    if (ticket.draftResponse) {
      await logActivity({
        ticketId: ticket.id,
        action:   ACTIONS.AI_DRAFT_GENERATED,
        detail:   buildDetail.aiDraftGenerated(classification.source),
      });
    }

    // Send emails (non-blocking)
    sendTicketCreatedClient(ticket, normalEmail);
    sendTicketCreatedAdmin(ticket, normalEmail);

    return NextResponse.json({ success: true, ticket, message: 'Your ticket has been submitted.' }, { status: 201 });
  } catch (err) {
    console.error('POST /api/portal/tickets error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
