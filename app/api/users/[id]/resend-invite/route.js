/**
 * POST /api/users/[id]/resend-invite
 * Regenerates the invite token (extends expiry) and resends the invite email.
 * Admin only. Only works for users who haven't accepted yet (inviteToken exists).
 */

import { NextResponse }        from 'next/server';
import { randomBytes }         from 'crypto';
import prisma                  from '../../../../../lib/prisma';
import { getUserFromRequest }  from '../../../../../lib/auth';
import { sendTeamInvite }      from '../../../../../lib/mailer';

const INVITE_EXPIRY_HOURS = 48;

export async function POST(request, { params }) {
  try {
    const { id }  = await params;
    const admin   = await getUserFromRequest(request);
    if (!admin || admin.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    if (user.isActive) {
      return NextResponse.json({ error: 'This user has already accepted their invite.' }, { status: 400 });
    }
    if (!user.inviteToken) {
      return NextResponse.json({ error: 'No pending invite for this user.' }, { status: 400 });
    }

    // Generate a fresh token and extend expiry
    const inviteToken  = randomBytes(24).toString('hex');
    const inviteExpiry = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id },
      data:  { inviteToken, inviteExpiry },
    });

    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    await sendTeamInvite({ ...user, inviteToken }, inviteToken, appUrl, admin);

    return NextResponse.json({ success: true, message: `Invite resent to ${user.email}.` });
  } catch (err) {
    console.error('POST /api/users/[id]/resend-invite error:', err);
    return NextResponse.json({ error: 'Failed to resend invite.' }, { status: 500 });
  }
}
