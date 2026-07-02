/**
 * Activity Logger
 * Helper to create TicketActivity records.
 * All ticket mutations should call logActivity() after the DB write.
 */

import prisma from './prisma';

/**
 * Log an activity entry for a ticket.
 *
 * @param {object} opts
 * @param {string}  opts.ticketId  - The ticket being acted upon
 * @param {string}  opts.action    - One of the ACTION constants below
 * @param {string}  [opts.detail]  - Human-readable description
 * @param {string}  [opts.oldValue]
 * @param {string}  [opts.newValue]
 * @param {object}  [opts.actor]   - { id, name, role } from JWT payload; omit for system/AI
 */
export async function logActivity({ ticketId, action, detail, oldValue, newValue, actor }) {
  try {
    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action,
        detail:   detail   ?? null,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
        userId:   actor?.id   ?? null,
        userName: actor?.name ?? null,
        userRole: actor?.role ?? null,
      },
    });
  } catch (err) {
    // Never let logging failures break the main request
    console.error('logActivity error:', err.message);
  }
}

// ─── Action Constants ───────────────────────────────────────────────────────
export const ACTIONS = {
  CREATED:           'created',
  STATUS_UPDATED:    'status_updated',
  PRIORITY_CHANGED:  'priority_changed',
  TEAM_REASSIGNED:   'team_reassigned',
  AI_DRAFT_GENERATED:'ai_draft_generated',
  TICKET_UPDATED:    'ticket_updated',
  TICKET_DELETED:    'ticket_deleted',
};
