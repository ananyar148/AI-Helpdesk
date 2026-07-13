/**
 * /api/users/[id]
 * PATCH - Update user name / team / role / isActive (Admin only)
 *         DELETE is intentionally removed — admins deactivate, not delete.
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
    const { name, role, team, isActive } = body;

    const validRoles = ['Admin', 'TeamMember'];
    const validTeams = ['Development', 'Billing', 'HR', 'Support'];

    if (role && !validRoles.includes(role))
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
    if (team && !validTeams.includes(team))
      return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });

    // Prevent admin from deactivating their own account
    if (admin.id === id && isActive === false) {
      return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
    }

    // Prevent activating a user who hasn't accepted their invite yet
    if (isActive === true) {
      const target = await prisma.user.findUnique({ where: { id }, select: { inviteToken: true } });
      if (target?.inviteToken) {
        return NextResponse.json({ error: 'This user has not accepted their invite yet. They will be activated automatically when they set their password.' }, { status: 400 });
      }
    }

    const updateData = {};
    if (name !== undefined)     updateData.name     = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role) {
      updateData.role = role;
      updateData.team = role === 'Admin' ? null : (team || undefined);
    }
    if (team && !role) updateData.team = team;

    const updated = await prisma.user.update({
      where:  { id },
      data:   updateData,
      select: { id: true, name: true, email: true, role: true, team: true, isActive: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    console.error('PATCH /api/users/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
  }
}
