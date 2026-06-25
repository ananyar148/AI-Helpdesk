/**
 * Prisma Seed Script
 * Creates initial admin and team member accounts for testing.
 * Run: node prisma/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash a shared default password
  const defaultPassword = await bcrypt.hash('password123', 12);

  // --- Create Admin ---
  const admin = await prisma.user.upsert({
    where: { email: 'admin@helpdesk.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@helpdesk.com',
      password: defaultPassword,
      role: 'Admin',
      team: null,
    },
  });
  console.log('✅ Admin created:', admin.email);

  // --- Create Team Members ---
  const teamMembers = [
    { name: 'Dev Team Member', email: 'dev@helpdesk.com', team: 'Development' },
    { name: 'Billing Team Member', email: 'billing@helpdesk.com', team: 'Billing' },
    { name: 'HR Team Member', email: 'hr@helpdesk.com', team: 'HR' },
    { name: 'Support Team Member', email: 'support@helpdesk.com', team: 'Support' },
  ];

  for (const member of teamMembers) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {},
      create: {
        ...member,
        password: defaultPassword,
        role: 'TeamMember',
      },
    });
    console.log(`✅ Team member created: ${user.email} (${user.team})`);
  }

  // --- Create Sample Tickets ---
  const sampleTickets = [
    {
      subject: 'Cannot login to my account',
      description: 'I have been trying to login since yesterday but keep getting an error message saying invalid credentials. I reset my password but still cannot access my account.',
      category: 'Bug',
      assignedTeam: 'Development',
      priority: 'High',
      status: 'Open',
      draftResponse: 'Thank you for reaching out. We apologize for the inconvenience you are experiencing. Our development team will investigate the login issue and get back to you within 24 hours.',
    },
    {
      subject: 'Incorrect charge on my invoice',
      description: 'I was charged twice for my subscription this month. My invoice number is INV-2024-001. Please refund the duplicate charge.',
      category: 'Billing',
      assignedTeam: 'Billing',
      priority: 'High',
      status: 'In Progress',
      draftResponse: 'We sincerely apologize for the billing error. Our billing team is reviewing your account and will process the refund within 3-5 business days.',
    },
    {
      subject: 'Request for feature: dark mode',
      description: 'It would be great if the application had a dark mode option. Many users prefer this for late-night use and it reduces eye strain.',
      category: 'Feature Request',
      assignedTeam: 'Development',
      priority: 'Low',
      status: 'Open',
      draftResponse: 'Thank you for your feature suggestion! We have logged this request and our product team will consider it for a future release.',
    },
    {
      subject: 'Leave request not being processed',
      description: 'I submitted my annual leave request two weeks ago but it still shows as pending. My manager has already verbally approved it.',
      category: 'HR',
      assignedTeam: 'HR',
      priority: 'Medium',
      status: 'Open',
      draftResponse: 'We understand your concern about your leave request. Our HR team will review the status and update it accordingly.',
    },
    {
      subject: 'Application crashes on startup',
      description: 'After the latest update, the application crashes immediately when I try to open it. I am using Windows 11 and the app version is 2.3.1.',
      category: 'Bug',
      assignedTeam: 'Development',
      priority: 'High',
      status: 'Resolved',
      draftResponse: 'We have identified and fixed the crash issue in version 2.3.2. Please update your application to resolve this problem.',
    },
  ];

  for (const ticket of sampleTickets) {
    await prisma.ticket.create({ data: ticket });
  }
  console.log(`✅ Created ${sampleTickets.length} sample tickets`);

  console.log('\n🎉 Seeding complete!');
  console.log('\nTest Accounts:');
  console.log('  Admin:   admin@helpdesk.com    / password123');
  console.log('  Dev:     dev@helpdesk.com      / password123');
  console.log('  Billing: billing@helpdesk.com  / password123');
  console.log('  HR:      hr@helpdesk.com       / password123');
  console.log('  Support: support@helpdesk.com  / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
