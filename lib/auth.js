/**
 * Authentication utilities
 * JWT-based auth using jose (Edge-compatible).
 */

import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-key'
);

/**
 * Sign a JWT token with user payload.
 * @param {object} payload - User data to embed (id, email, role, team)
 * @returns {Promise<string>} Signed JWT string
 */
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {Promise<object|null>} Decoded payload or null if invalid
 */
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get the current user from a request's cookie.
 * @param {Request} request
 * @returns {Promise<object|null>} User payload or null
 */
export async function getUserFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );

  const token = cookies['auth_token'];
  if (!token) return null;

  return verifyToken(token);
}
