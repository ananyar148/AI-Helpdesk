/**
 * Activity Logger
 * Records every ticket action with full user attribution:
 *   userId, userName, userRole, userTeam
 */

import prisma from './prisma';

// ─── Actor label helper ───────────────────────────────────────────────────────
export function actorLabel(actor) {
  if (!actor) return 'System';
  // Always include role explicitly so Admin vs TeamMember is unambiguous in logs
  const parts = [actor.name];
  if (actor.team) parts.push(actor.team);
  parts.push(actor.role);
  return `${parts[0]} (${parts.slice(1).join(' · ')})`;
}

// ─── Core log function ────────────────────────────────────────────────────────
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
        userTeam: actor?.team ?? null,
      },
    });
  } catch (err) {
    console.error('logActivity error:', err.message);
  }
}

// ─── Pre-built detail generators ─────────────────────────────────────────────
export const buildDetail = {
  statusUpdated:    (actor, from, to)          => `${actorLabel(actor)} changed status from "${from}" to "${to}"`,
  priorityChanged:  (actor, from, to)          => `${actorLabel(actor)} changed priority from "${from}" to "${to}"`,
  categoryChanged:  (actor, from, to)          => `${actorLabel(actor)} changed category from "${from}" to "${to}"`,
  assignedTo:       (actor, toName)            => `${actorLabel(actor)} assigned ticket to ${toName}`,
  unassigned:       (actor)                    => `${actorLabel(actor)} removed individual assignment`,
  teamsUpdated:     (actor, added, removed)    => {
    const parts = [];
    if (added.length)   parts.push(`added ${added.join(', ')}`);
    if (removed.length) parts.push(`removed ${removed.join(', ')}`);
    return `${actorLabel(actor)} updated assigned teams: ${parts.join('; ')}`;
  },
  teamsAssigned:    (actor, teams)             => `${actorLabel(actor)} assigned ticket to ${teams.join(', ')}`,
  workLogAdded:     (actor, visibility)        => `${actorLabel(actor)} added a ${visibility.toLowerCase()} work log`,
  ticketDeleted:    (actor, subject)           => `${actorLabel(actor)} deleted ticket "${subject}"`,
  ticketCreated:    (category, teams, src)     => `Ticket submitted by client — classified as ${category} → ${Array.isArray(teams) ? teams.join(', ') : teams} (source: ${src})`,
  aiDraftGenerated: (src)                      => `AI draft response generated (source: ${src})`,
  duplicateLinked:  (actor, originalId, score) => `${actorLabel(actor)} submitted as duplicate of #${originalId} (${score}% similar)`,
  detailsRequested: (actor, clientEmail)       => `${actorLabel(actor)} sent a "more details" request to ${clientEmail}`,
  detailsProvided:  (clientEmail)              => `Client (${clientEmail}) provided additional details`,
  followUpAdded:    (clientEmail)              => `Client (${clientEmail}) added a follow-up`,
};

// ─── Action Constants ─────────────────────────────────────────────────────────
export const ACTIONS = {
  CREATED:            'created',
  STATUS_UPDATED:     'status_updated',
  PRIORITY_CHANGED:   'priority_changed',
  CATEGORY_CHANGED:   'category_changed',
  ASSIGNED_TO:        'assigned_to',
  TEAMS_UPDATED:      'teams_updated',
  AI_DRAFT_GENERATED: 'ai_draft_generated',
  WORK_LOG_ADDED:     'work_log_added',
  TICKET_UPDATED:     'ticket_updated',
  TICKET_DELETED:     'ticket_deleted',
  DUPLICATE_DETECTED: 'duplicate_detected',
  DETAILS_REQUESTED:  'details_requested',
  DETAILS_PROVIDED:   'details_provided',
  FOLLOW_UP_ADDED:    'follow_up_added',
};
