/**
 * Authentication utilities
 * JWT-based auth using jose (Edge-compatible for middleware).
 *
 * Design:
 *  - signToken / verifyToken  → used in middleware (Edge runtime, no Prisma)
 *  - getUserFromRequest        → used in API routes; re-fetches from DB so the
 *    user object is always fresh (role/team changes take effect immediately)
 */

import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-key'
);

// ─── JWT helpers (Edge-safe, no DB) ─────────────────────────────────────────

/**
 * Sign a JWT containing the user's id + key profile fields.
 * @param {{ id, name, email, role, team }} payload
 * @returns {Promise<string>}
 */
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

/**
 * Verify and decode a JWT.
 * Returns the payload or null if invalid/expired.
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch {
    return null;
  }
}

// ─── API route helper (re-fetches user from DB) ──────────────────────────────

/**
 * Get the full, fresh user record from the database using the auth cookie.
 *
 * Why re-fetch instead of trusting the JWT payload?
 *  - If an admin updates a user's role or team, the change takes effect
 *    immediately — no need to wait for the JWT to expire.
 *  - Activity logs always record the current role/team, not a stale snapshot.
 *
 * Returns null if the cookie is missing, the JWT is invalid, or the user
 * no longer exists in the database.
 *
 * NOTE: This imports Prisma dynamically so it is NOT used in middleware
 * (which runs on the Edge runtime where Prisma is unavailable).
 *
 * @param {Request} request
 * @returns {Promise<{ id, name, email, role, team } | null>}
 */
export async function getUserFromRequest(request) {
  // Parse the auth_token cookie manually (works in both Node and Edge)
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );

  const token = cookies['auth_token'];
  if (!token) return null;

  // Verify the JWT to get the user id
  const payload = await verifyToken(token);
  if (!payload?.id) return null;

  // Re-fetch from DB so role/team are always current
  try {
    const { default: prisma } = await import('./prisma.js');
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, name: true, email: true, role: true, team: true },
    });
    return user ?? null;
  } catch (err) {
    console.error('getUserFromRequest DB error:', err.message);
    // Fall back to JWT payload if DB is temporarily unavailable
    return {
      id:    payload.id,
      name:  payload.name,
      email: payload.email,
      role:  payload.role,
      team:  payload.team,
    };
  }
}
