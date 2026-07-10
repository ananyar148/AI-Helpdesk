/**
 * Prisma Seed Script
 * Run: npm run db:seed
 *
 * Creates (idempotent — safe to re-run):
 *  - 1 Admin
 *  - 8 Team Members (2 per team: Development, Billing, HR, Support)
 *  - 5 Sample Tickets with activity logs
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function nextTicketNumber() {
  const result = await prisma.$queryRaw`SELECT nextval('ticket_number_seq')::int AS num`;
  return result[0].num;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function logActivity(ticketId, action, detail, oldValue, newValue, actor) {
  await prisma.ticketActivity.create({
    data: {
      ticketId,
      action,
      detail,
      oldValue:  oldValue  ?? null,
      newValue:  newValue  ?? null,
      userId:    actor?.id   ?? null,
      userName:  actor?.name ?? null,
      userRole:  actor?.role ?? null,
      userTeam:  actor?.team ?? null,
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  const pw = await bcrypt.hash('password123', 12);

  // ── Admin ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where:  { email: 'admin@helpdesk.com' },
    update: {},
    create: {
      name:     'Admin User',
      email:    'admin@helpdesk.com',
      password: pw,
      role:     'Admin',
      team:     null,
    },
  });
  console.log('✅ Admin:', admin.email);

  // ── Team Members ───────────────────────────────────────────────────────────
  const memberDefs = [
    { name: 'Rahul Dev',      email: 'rahul.dev@helpdesk.com',      team: 'Development' },
    { name: 'Priya Dev',      email: 'priya.dev@helpdesk.com',      team: 'Development' },
    { name: 'Arjun Billing',  email: 'arjun.billing@helpdesk.com',  team: 'Billing'     },
    { name: 'Sneha Billing',  email: 'sneha.billing@helpdesk.com',  team: 'Billing'     },
    { name: 'Divya HR',       email: 'divya.hr@helpdesk.com',       team: 'HR'          },
    { name: 'Vikram HR',      email: 'vikram.hr@helpdesk.com',      team: 'HR'          },
    { name: 'Ananya Support', email: 'ananya.support@helpdesk.com', team: 'Support'     },
    { name: 'Rohan Support',  email: 'rohan.support@helpdesk.com',  team: 'Support'     },
  ];

  // Map team → first member (used for activity log actors)
  const teamRep = {};
  for (const m of memberDefs) {
    const u = await prisma.user.upsert({
      where:  { email: m.email },
      update: {},
      create: { name: m.name, email: m.email, password: pw, role: 'TeamMember', team: m.team },
    });
    if (!teamRep[m.team]) teamRep[m.team] = u;
    console.log(`✅ ${u.name} (${u.team})`);
  }

  // ── Tickets ────────────────────────────────────────────────────────────────
  // Only create tickets that don't already exist (matched by subject + clientEmail)
  const ticketDefs = [
    {
      subject:       'Login page returns 500 error',
      description:   'When I try to log in with my credentials I get a "500 Internal Server Error". ' +
                     'This started after the last deployment. Tried clearing cache and a different browser — same result.',
      category:      'Bug',
      assignedTeams: ['Development'],
      priority:      'High',
      status:        'Open',
      clientEmail:   'james.carter@example.com',
      draftResponse: 'Thank you for reporting this. Our development team has been alerted and is investigating the 500 error on the login page as a priority issue.',
      createdAt:     daysAgo(3),
    },
    {
      subject:       'Charged twice for this month\'s subscription',
      description:   'I can see two charges of $49.99 on my credit card statement dated the 1st of this month, ' +
                     'both from your company. Account number: ACC-8821. Please refund the duplicate charge.',
      category:      'Billing',
      assignedTeams: ['Billing'],
      priority:      'High',
      status:        'In Progress',
      clientEmail:   'noah.taylor@example.com',
      draftResponse: 'We sincerely apologise for the duplicate charge. Our billing team has confirmed the error and will process your refund of $49.99 within 3–5 business days.',
      createdAt:     daysAgo(5),
    },
    {
      subject:       'Annual leave balance showing incorrect days',
      description:   'My leave balance shows 5 days remaining but per my contract I should have 12. ' +
                     'I took only 8 days this year and my annual entitlement is 20 days. Please review.',
      category:      'HR',
      assignedTeams: ['HR'],
      priority:      'Medium',
      status:        'In Progress',
      clientEmail:   'ava.anderson@example.com',
      draftResponse: 'Thank you for flagging this. Our HR team is reviewing your leave records and will correct any discrepancies within 2 business days.',
      createdAt:     daysAgo(6),
    },
    {
      subject:       'Account locked after failed login attempts',
      description:   'My account has been locked due to too many failed login attempts. ' +
                     'I was testing whether I remembered my old password. Can you please unlock my account?',
      category:      'Other',
      assignedTeams: ['Support'],
      priority:      'Medium',
      status:        'Resolved',
      clientEmail:   'amelia.garcia@example.com',
      draftResponse: 'Your account has been unlocked. For security we\'ve also sent a password reset link to your email — please update your password after logging in.',
      createdAt:     daysAgo(10),
    },
    {
      subject:       'Add dark mode to the application',
      description:   'Many of us use the app late at night and the bright white interface causes eye strain. ' +
                     'Could you add a dark mode option that can be toggled in user settings?',
      category:      'Feature Request',
      assignedTeams: ['Development'],
      priority:      'Low',
      status:        'Open',
      clientEmail:   'liam.johnson@example.com',
      draftResponse: 'Thank you for the suggestion! We\'ve added dark mode to our feature backlog and will evaluate it for an upcoming release.',
      createdAt:     daysAgo(8),
    },
  ];

  console.log('\n📋 Creating tickets...');
  let created = 0;
  let skipped = 0;

  for (const def of ticketDefs) {
    // Skip if a ticket with the same subject + clientEmail already exists
    const existing = await prisma.ticket.findFirst({
      where: { subject: def.subject, clientEmail: def.clientEmail },
    });

    if (existing) {
      console.log(`  ⏭  [skipped — exists] ${def.subject}`);
      skipped++;
      continue;
    }

    const ticket = await prisma.ticket.create({ data: { ...def, ticketNumber: await nextTicketNumber() } });
    const actor  = teamRep[def.assignedTeams[0]];

    // Activity: ticket created
    await logActivity(
      ticket.id, 'created',
      `Ticket submitted by client — classified as ${ticket.category} → ${ticket.assignedTeams.join(', ')} (source: classifier)`,
      null, null, null
    );

    // Activity: AI draft generated
    if (ticket.draftResponse) {
      await logActivity(ticket.id, 'ai_draft_generated', 'AI draft response generated (source: vertex-ai)', null, null, null);
    }

    // Activity: status progression for non-Open tickets
    if (ticket.status === 'In Progress') {
      await logActivity(
        ticket.id, 'status_updated',
        `${actor.name} (${actor.team} · TeamMember) changed status from "Open" to "In Progress"`,
        'Open', 'In Progress', actor
      );
    }

    if (ticket.status === 'Resolved') {
      await logActivity(
        ticket.id, 'status_updated',
        `${actor.name} (${actor.team} · TeamMember) changed status from "Open" to "In Progress"`,
        'Open', 'In Progress', actor
      );
      await logActivity(
        ticket.id, 'status_updated',
        `${actor.name} (${actor.team} · TeamMember) changed status from "In Progress" to "Resolved"`,
        'In Progress', 'Resolved', actor
      );
    }

    console.log(`  ✅ [#${String(ticket.ticketNumber).padStart(3, '0')} · ${ticket.status.padEnd(11)}] ${ticket.subject}`);
    created++;
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seeding complete!');
  console.log(`   Users:          ${1 + memberDefs.length} (1 admin + ${memberDefs.length} team members)`);
  console.log(`   Tickets created: ${created}  |  skipped (already exist): ${skipped}`);
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  Login credentials  (password: password123)');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  Admin       admin@helpdesk.com');
  console.log('  Dev         rahul.dev@helpdesk.com');
  console.log('  Dev         priya.dev@helpdesk.com');
  console.log('  Billing     arjun.billing@helpdesk.com');
  console.log('  Billing     sneha.billing@helpdesk.com');
  console.log('  HR          divya.hr@helpdesk.com');
  console.log('  HR          vikram.hr@helpdesk.com');
  console.log('  Support     ananya.support@helpdesk.com');
  console.log('  Support     rohan.support@helpdesk.com');
  console.log('─────────────────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
