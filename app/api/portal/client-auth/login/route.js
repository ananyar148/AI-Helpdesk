/**
 * POST /api/portal/client-auth/login
 * Sign in a client with email + password.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '../../../../../lib/prisma';
import { signClientToken, setClientCookie } from '../../../../../lib/clientAuth';

export async function POST(request) {
  try {
    const { email: rawEmail, password } = await request.json();

    const email = rawEmail?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    if (!password)
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });

    const client = await prisma.clientUser.findUnique({ where: { email } });

    // Generic message to avoid leaking whether the email is registered
    if (!client || !client.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, client.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = await signClientToken({
      id: client.id, name: client.name, email: client.email,
    });

    const res = NextResponse.json({
      success: true,
      client: { id: client.id, name: client.name, email: client.email },
    });

    setClientCookie(res, token);
    return res;
  } catch (err) {
    console.error('POST /api/portal/client-auth/login error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
