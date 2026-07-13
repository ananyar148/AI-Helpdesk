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
 * Jaccard similarity between two strings (0–1), word-level.
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

/**
 * Character-level trigram similarity (0–1).
 * Much better at catching typos and repeated-character variants like
 * "buggggg" vs "bugggggg" where word-level Jaccard gives 0.
 */
function trigramSimilarity(a, b) {
  const norm = (s) => normalizeText(s).replace(/\s/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (na.length < 3 && nb.length < 3) return na === nb ? 1 : 0;

  const trigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
    return set;
  };
  const ta = trigrams(na);
  const tb = trigrams(nb);
  if (ta.size === 0 || tb.size === 0) return 0;
  const inter = new Set([...ta].filter(g => tb.has(g)));
  return (2 * inter.size) / (ta.size + tb.size); // Dice coefficient
}

/**
 * Normalized Levenshtein distance → similarity (0–1).
 * Best for very short strings (≤ 30 chars).
 */
function levenshteinSimilarity(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  const la = na.length;
  const lb = nb.length;
  if (la === 0 && lb === 0) return 1;
  if (la === 0 || lb === 0) return 0;

  const dp = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = na[i - 1] === nb[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[la][lb] / Math.max(la, lb);
}

/**
 * Combined subject similarity — blends Jaccard, trigrams, and Levenshtein.
 * Short subjects lean heavily on character-level signals.
 */
function subjectSimilarity(a, b) {
  const jaccard   = jaccardSimilarity(a, b);
  const trigram   = trigramSimilarity(a, b);
  const levLength = Math.max(normalizeText(a).length, normalizeText(b).length);
  // Only use Levenshtein for short subjects (< 40 chars) — expensive on long text
  const lev       = levLength <= 40 ? levenshteinSimilarity(a, b) : trigram;

  // For very short subjects (single "word"), character signals dominate
  const wordCountA = normalizeText(a).split(' ').filter(Boolean).length;
  const wordCountB = normalizeText(b).split(' ').filter(Boolean).length;
  if (Math.max(wordCountA, wordCountB) <= 2) {
    return trigram * 0.4 + lev * 0.4 + jaccard * 0.2;
  }
  return jaccard * 0.5 + trigram * 0.35 + lev * 0.15;
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
  const subjectSim    = subjectSimilarity(newTicket.subject,     existing.subject);
  const descSim       = jaccardSimilarity(newTicket.description,  existing.description);
  const categoryBonus = newTicket.category     === existing.category     ? 1 : 0;
  const teamBonus     = newTicket.assignedTeam === existing.assignedTeam ? 1 : 0;

  // Subject-dominance: nearly identical subjects always constitute a duplicate
  if (subjectSim >= 0.65) {
    return Math.max(
      subjectSim * 0.50 + descSim * 0.35 + categoryBonus * 0.10 + teamBonus * 0.05,
      0.65
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
