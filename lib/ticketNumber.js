/**
 * Ticket number sequencing
 *
 * Only ROOT tickets (no parentTicketId) get a human-readable number.
 * Follow-ups and "provide-details" responses are linked to their parent
 * via parentTicketId and keep ticketNumber = null.
 *
 * The number is drawn from a Postgres sequence (ticket_number_seq) so it
 * is atomic and gap-free even under concurrent requests.
 */

import prisma from './prisma.js';

/**
 * Returns the next integer from ticket_number_seq.
 * Must be called inside the same transaction that creates the ticket,
 * or immediately before — the sequence is non-transactional so it never
 * rolls back, which is fine (we just want monotonically increasing numbers).
 */
export async function nextTicketNumber() {
  const result = await prisma.$queryRaw`SELECT nextval('ticket_number_seq')::int AS num`;
  return result[0].num;
}
