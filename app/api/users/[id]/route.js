/**
 * /api/users/[id]
 * PATCH  - Update user name / team / role (Admin only)
 * DELETE - Delete user (Admin only)
 */

import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const admin = await getUserFromRequest(request);
    if (!admin || admin.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, role, team } = body;

    const validRoles = ['Admin', 'TeamMember'];
    const validTeams = ['Development', 'Billing', 'HR', 'Support'];

    if (role && !validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
    if (team && !validTeams.includes(team)) return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (role) {
      updateData.role = role;
      updateData.team = role === 'Admin' ? null : (team || undefined);
    }
    if (team && !role) updateData.team = team;

    const updated = await prisma.user.update({
      where: { id },
      data:  updateData,
      select: { id: true, name: true, email: true, role: true, team: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    console.error('PATCH /api/users/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const admin = await getUserFromRequest(request);
    if (!admin || admin.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }
    if (admin.id === id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error('DELETE /api/users/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete user.' }, { status: 500 });
  }
}
