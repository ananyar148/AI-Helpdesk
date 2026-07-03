/**
 * Duplicate Detection Service
 *
 * Compares a new ticket against existing Open/In-Progress tickets using
 * a multi-signal similarity score:
 *   - Subject text similarity  (Jaccard, weight 0.5)  ← primary signal
 *   - Description similarity   (Jaccard, weight 0.35)
 *   - Category match bonus     (weight 0.10)
 *   - Team match bonus         (weight 0.05)
 *
 * Subject-dominance rule: if subject Jaccard ≥ 0.70, always warn
 * regardless of description (catches synonym-heavy descriptions like
 * "issue" vs "problem").
 *
 * Threshold for "warn user": 0.60  (60%)
 * Threshold for "auto-reuse classification": 0.55
 */

// ─── Text utilities ───────────────────────────────────────────────────────────

/**
 * Normalize text: lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize into unique word set.
 */
function toWordSet(text) {
  return new Set(normalizeText(text).split(' ').filter(Boolean));
}

/**
 * Jaccard similarity between two strings (0–1).
 */
export function jaccardSimilarity(a, b) {
  const setA = toWordSet(a);
  const setB = toWordSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union        = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// ─── Composite similarity ─────────────────────────────────────────────────────

/**
 * Calculate a weighted similarity score between a new ticket and an existing one.
 *
 * @param {{ subject, description, category, assignedTeam }} newTicket
 * @param {{ subject, description, category, assignedTeam }} existing
 * @returns {number} 0–1
 */
export function ticketSimilarity(newTicket, existing) {
  const subjectSim    = jaccardSimilarity(newTicket.subject,     existing.subject);
  const descSim       = jaccardSimilarity(newTicket.description,  existing.description);
  const categoryBonus = newTicket.category     === existing.category     ? 1 : 0;
  const teamBonus     = newTicket.assignedTeam === existing.assignedTeam ? 1 : 0;

  // Subject-dominance: nearly identical subjects always constitute a duplicate
  // regardless of how differently the description is worded (synonyms, etc.)
  if (subjectSim >= 0.70) {
    // Force score high enough to always trigger the warn threshold
    return Math.max(
      subjectSim * 0.50 + descSim * 0.35 + categoryBonus * 0.10 + teamBonus * 0.05,
      0.65 // floor — guarantee a warn when subjects almost match
    );
  }

  return (
    subjectSim    * 0.50 +
    descSim       * 0.35 +
    categoryBonus * 0.10 +
    teamBonus     * 0.05
  );
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Score ≥ this → warn the user a duplicate may exist (UI prompt) */
export const DUPLICATE_WARN_THRESHOLD  = 0.60;

/** Score ≥ this → reuse classification silently (no Gemini call needed) */
export const DUPLICATE_REUSE_THRESHOLD = 0.55;

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Find the best-matching existing ticket for a new submission.
 *
 * Only compares against Open and In-Progress tickets (Resolved ones are done).
 *
 * @param {{ subject, description, category, assignedTeam }} newTicket
 * @param {Array} existingTickets  — from DB (must include subject/description/category/assignedTeam/status)
 * @returns {{ match: object|null, score: number, shouldWarn: boolean, shouldReuse: boolean }}
 */
export function findBestMatch(newTicket, existingTickets) {
  let bestMatch = null;
  let bestScore = 0;

  const active = existingTickets.filter(
    (t) => t.status === 'Open' || t.status === 'In Progress'
  );

  for (const existing of active) {
    const score = ticketSimilarity(newTicket, existing);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = existing;
    }
  }

  return {
    match:       bestScore >= DUPLICATE_REUSE_THRESHOLD ? bestMatch : null,
    score:       bestScore,
    shouldWarn:  bestScore >= DUPLICATE_WARN_THRESHOLD,
    shouldReuse: bestScore >= DUPLICATE_REUSE_THRESHOLD,
  };
}
