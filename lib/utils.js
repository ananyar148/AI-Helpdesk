/**
 * Shared utility helpers
 */

/**
 * Formats an auto-increment ticket number as a zero-padded string.
 * e.g. 1 → "001", 42 → "042", 1000 → "1000"
 */
export function formatTicketNumber(n) {
  if (n == null) return '—';
  return String(n).padStart(3, '0');
}
