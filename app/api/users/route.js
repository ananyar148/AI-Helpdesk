/**
 * /api/users
 * GET  - List all users (Admin only)
 * POST - Create a new team member (Admin only)
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, team: true, createdAt: true },
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
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, team } = body;

    // Validation
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Name, email, password, and role are required.' }, { status: 400 });
    }
    if (role === 'TeamMember' && !team) {
      return NextResponse.json({ error: 'Team is required for TeamMember role.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const validRoles = ['Admin', 'TeamMember'];
    const validTeams = ['Development', 'Billing', 'HR', 'Support'];
    if (!validRoles.includes(role))             return NextResponse.json({ error: 'Invalid role.' },  { status: 400 });
    if (role === 'TeamMember' && !validTeams.includes(team)) {
      return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        name:     name.trim(),
        email:    email.toLowerCase().trim(),
        password: hashed,
        role,
        team:     role === 'TeamMember' ? team : null,
      },
      select: { id: true, name: true, email: true, role: true, team: true, createdAt: true },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (err) {
    console.error('POST /api/users error:', err);
    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 });
  }
}
