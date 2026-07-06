/**
 * NextAuth — Google OAuth for Client Portal
 * Mounted at /api/auth/[...nextauth] so the Google callback URI is:
 *   http://localhost:3000/api/auth/callback/google
 */

import NextAuth          from 'next-auth';
import { authOptions }   from '../../../../lib/authOptions';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
