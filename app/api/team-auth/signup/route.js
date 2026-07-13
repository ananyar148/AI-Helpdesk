/**
 * /api/team-auth/signup
 * POST - Accept a team invite: validate token, set password, activate account.
 */

import { NextResponse } from 'next/server';
import bcrypt           from 'bcryptjs';
import prisma           from '../../../../lib/prisma';
import { signToken }    from '../../../../lib/auth';

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { inviteToken: token } });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired invite link.' }, { status: 400 });
    }
    if (user.isActive) {
      return NextResponse.json({ error: 'This invite has already been used.' }, { status: 400 });
    }
    if (user.inviteExpiry && new Date() > new Date(user.inviteExpiry)) {
      return NextResponse.json({ error: 'This invite link has expired. Ask your admin to resend it.' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password:     hashed,
        isActive:     true,
        inviteToken:  null,   // consume the token
        inviteExpiry: null,
      },
    });

    // Auto-login: set auth cookie so they land on their dashboard directly
    const authToken = await signToken({
      id:    updated.id,
      name:  updated.name,
      email: updated.email,
      role:  updated.role,
      team:  updated.team,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, team: updated.team },
    });

    response.cookies.set('auth_token', authToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7 * 24 * 60 * 60,
      path:     '/',
    });

    return response;
  } catch (err) {
    console.error('POST /api/team-auth/signup error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
