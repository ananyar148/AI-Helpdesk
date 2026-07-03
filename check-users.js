const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const OLD_GENERIC_EMAILS = [
  'dev@helpdesk.com',
  'billing@helpdesk.com',
  'hr@helpdesk.com',
  'support@helpdesk.com',
];

async function main() {
  const deleted = await p.user.deleteMany({
    where: { email: { in: OLD_GENERIC_EMAILS } },
  });
  console.log(`Deleted ${deleted.count} generic team accounts.`);

  const users = await p.user.findMany({
    select: { name: true, email: true, role: true, team: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\nRemaining users:\n');
  users.forEach(u =>
    console.log(`  ${u.role.padEnd(12)} | ${(u.team || '—').padEnd(14)} | ${u.name.padEnd(20)} | ${u.email}`)
  );
  console.log(`\nTotal: ${users.length} users`);
}

main().finally(() => p.$disconnect());
