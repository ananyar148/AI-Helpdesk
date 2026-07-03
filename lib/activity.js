/**
 * Activity Logger
 * Records every ticket action with full user attribution:
 *   userId, userName, userRole, userTeam
 *
 * Detail strings follow the pattern:
 *   "Ram (Development) changed status to In Progress"
 *   "Shyam (Development) fixed the API issue"
 *   "Admin reassigned ticket to HR team"
 */

import prisma from './prisma';

// ─── Actor label helper ───────────────────────────────────────────────────────

/**
 * Build the "Name (Team)" or "Name (Admin)" label for display in detail strings.
 * @param {{ name, role, team }} actor
 * @returns {string}  e.g. "Ram (Development)" | "Admin User (Admin)"
 */
export function actorLabel(actor) {
  if (!actor) return 'System';
  const context = actor.team || actor.role || 'Unknown';
  return `${actor.name} (${context})`;
}

// ─── Core log function ────────────────────────────────────────────────────────

/**
 * Persist a TicketActivity row.
 *
 * @param {object}  opts
 * @param {string}  opts.ticketId
 * @param {string}  opts.action      — one of ACTIONS constants
 * @param {string}  [opts.detail]    — human-readable sentence
 * @param {string}  [opts.oldValue]
 * @param {string}  [opts.newValue]
 * @param {object}  [opts.actor]     — { id, name, role, team } from getUserFromRequest()
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
        userTeam: actor?.team ?? null,   // ← stores e.g. "Development"
      },
    });
  } catch (err) {
    console.error('logActivity error:', err.message);
  }
}

// ─── Pre-built detail generators ─────────────────────────────────────────────
// Call these from API routes so every detail string is consistent.

export const buildDetail = {
  statusUpdated:    (actor, from, to)     => `${actorLabel(actor)} changed status from "${from}" to "${to}"`,
  priorityChanged:  (actor, from, to)     => `${actorLabel(actor)} changed priority from "${from}" to "${to}"`,
  teamReassigned:   (actor, from, to)     => `${actorLabel(actor)} reassigned ticket from ${from} to ${to}`,
  workLogAdded:     (actor, visibility)   => `${actorLabel(actor)} added a ${visibility.toLowerCase()} work log`,
  ticketDeleted:    (actor, subject)      => `${actorLabel(actor)} deleted ticket "${subject}"`,
  ticketCreated:    (category, team, src) => `Ticket submitted by client — classified as ${category} → ${team} (source: ${src})`,
  aiDraftGenerated: (src)                 => `AI draft response generated (source: ${src})`,
  duplicateLinked:  (actor, originalId, score) =>
    `${actorLabel(actor)} submitted as duplicate of #${originalId} (${score}% similar)`,
};

// ─── Action Constants ─────────────────────────────────────────────────────────
export const ACTIONS = {
  CREATED:            'created',
  STATUS_UPDATED:     'status_updated',
  PRIORITY_CHANGED:   'priority_changed',
  TEAM_REASSIGNED:    'team_reassigned',
  AI_DRAFT_GENERATED: 'ai_draft_generated',
  WORK_LOG_ADDED:     'work_log_added',
  TICKET_UPDATED:     'ticket_updated',
  TICKET_DELETED:     'ticket_deleted',
  DUPLICATE_DETECTED: 'duplicate_detected',
};
