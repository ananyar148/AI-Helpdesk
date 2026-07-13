/**
 * /api/users
 * GET  - List all users (Admin only)
 * POST - Invite a new team member (Admin only)
 *        Creates the user as inactive with no password, emails them a signup link.
 */

import { NextResponse }  from 'next/server';
import { randomBytes }   from 'crypto';
import prisma            from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { sendTeamInvite } from '../../../lib/mailer';

const INVITE_EXPIRY_HOURS = 48;

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, team: true, isActive: true, inviteToken: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error('GET /api/users error:', err);
    return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getUserFromRequest(request);
    if (!admin || admin.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role, team } = body;

    // Validation
    if (!name?.trim() || !email?.trim() || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required.' }, { status: 400 });
    }
    if (role === 'TeamMember' && !team) {
      return NextResponse.json({ error: 'Team is required for TeamMember role.' }, { status: 400 });
    }

    const validRoles = ['Admin', 'TeamMember'];
    const validTeams = ['Development', 'Billing', 'HR', 'Support'];
    if (!validRoles.includes(role))
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
    if (role === 'TeamMember' && !validTeams.includes(team))
      return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });

    const normalEmail = email.toLowerCase().trim();

    // Check uniqueness
    const existing = await prisma.user.findUnique({ where: { email: normalEmail } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
    }

    // Generate a secure one-time invite token (48-char hex)
    const inviteToken  = randomBytes(24).toString('hex');
    const inviteExpiry = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    const newUser = await prisma.user.create({
      data: {
        name:         name.trim(),
        email:        normalEmail,
        password:     null,          // set by the user during signup
        role,
        team:         role === 'TeamMember' ? team : null,
        isActive:     false,         // activated after signup
        inviteToken,
        inviteExpiry,
      },
      select: { id: true, name: true, email: true, role: true, team: true, isActive: true, createdAt: true },
    });

    // Send invite email (non-blocking)
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    await sendTeamInvite(newUser, inviteToken, appUrl, admin);

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (err) {
    console.error('POST /api/users error:', err);
    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 });
  }
}
