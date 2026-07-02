const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tickets = await prisma.ticket.findMany({
    select: { id: true, subject: true, status: true, assignedTeam: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n=== TICKETS IN DATABASE ===');
  console.log('Total:', tickets.length);
  console.log('');
  tickets.forEach((t, i) => {
    console.log(
      `${String(i+1).padStart(2)}. [${t.id.slice(0,12)}] ${t.assignedTeam.padEnd(12)} | ${t.status.padEnd(12)} | ${t.subject.slice(0, 40)}`
    );
  });

  // Check for duplicates by subject
  const subjects = tickets.map(t => t.subject);
  const dupes = subjects.filter((s, i) => subjects.indexOf(s) !== i);
  if (dupes.length > 0) {
    console.log('\n⚠️  DUPLICATE SUBJECTS FOUND:', [...new Set(dupes)]);
  } else {
    console.log('\n✅ No duplicate subjects');
  }
}

main()
  .catch(console.error)
  .then(() => prisma.$disconnect());
