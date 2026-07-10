/**
 * Client Portal Auth Utilities
 * JWT-based auth for client users (separate from team auth_token cookie).
 * Cookie name: client_token
 */

import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-key'
);

export async function signClientToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

export async function verifyClientToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get the authenticated client user from the client_token cookie.
 * Re-fetches from DB so the record is always fresh.
 */
export async function getClientFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );

  const token = cookies['client_token'];
  if (!token) return null;

  const payload = await verifyClientToken(token);
  if (!payload?.id) return null;

  try {
    const { default: prisma } = await import('./prisma.js');
    const client = await prisma.clientUser.findUnique({
      where:  { id: payload.id },
      select: { id: true, name: true, email: true, picture: true },
    });
    return client ?? null;
  } catch {
    return { id: payload.id, name: payload.name, email: payload.email, picture: payload.picture ?? null };
  }
}

export function setClientCookie(response, token) {
  response.cookies.set('client_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60,
    path:     '/',
  });
}

export function clearClientCookie(response) {
  response.cookies.set('client_token', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  });
}
