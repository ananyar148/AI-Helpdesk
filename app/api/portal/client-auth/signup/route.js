/**
 * POST /api/portal/client-auth/signup
 * Register a new client with name, email, password.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '../../../../../lib/prisma';
import { signClientToken, setClientCookie } from '../../../../../lib/clientAuth';

export async function POST(request) {
  try {
    const { name, email: rawEmail, password } = await request.json();

    const email = rawEmail?.trim().toLowerCase();

    if (!name?.trim())
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    if (!password || password.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });

    // Check if email already registered
    const existing = await prisma.clientUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const client = await prisma.clientUser.create({
      data: { name: name.trim(), email, passwordHash },
    });

    const token = await signClientToken({
      id: client.id, name: client.name, email: client.email,
    });

    const res = NextResponse.json({
      success: true,
      client: { id: client.id, name: client.name, email: client.email },
    }, { status: 201 });

    setClientCookie(res, token);
    return res;
  } catch (err) {
    console.error('POST /api/portal/client-auth/signup error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
