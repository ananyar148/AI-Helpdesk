/**
 * /api/team-auth/verify-invite?token=xxx
 * GET - Check if an invite token is valid (not expired, not used).
 *       Returns user's name so the signup page can greet them.
 */

import { NextResponse } from 'next/server';
import prisma           from '../../../../lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token is required.' });
    }

    const user = await prisma.user.findUnique({ where: { inviteToken: token } });

    if (!user) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired invite link.' });
    }
    if (user.isActive) {
      return NextResponse.json({ valid: false, error: 'This invite has already been used.' });
    }
    if (user.inviteExpiry && new Date() > new Date(user.inviteExpiry)) {
      return NextResponse.json({ valid: false, error: 'This invite link has expired. Ask your admin to resend it.' });
    }

    return NextResponse.json({ valid: true, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error('GET /api/team-auth/verify-invite error:', err);
    return NextResponse.json({ valid: false, error: 'Could not verify invite.' });
  }
}
