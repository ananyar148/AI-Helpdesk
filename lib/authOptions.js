/**
 * NextAuth configuration — shared authOptions
 * Exported separately so getServerSession(authOptions) can be used in API routes.
 */

import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    /**
     * On every sign-in, upsert the ClientUser record in the database.
     * Attach the DB id to the token so it flows into the session.
     */
    async jwt({ token, account, profile }) {
      if (account && profile) {
        try {
          const { default: prisma } = await import('./prisma.js');
          const clientUser = await prisma.clientUser.upsert({
            where:  { googleId: profile.sub },
            update: {
              name:    profile.name,
              picture: profile.picture,
              email:   profile.email,
            },
            create: {
              googleId: profile.sub,
              email:    profile.email,
              name:     profile.name,
              picture:  profile.picture || null,
            },
          });
          token.clientUserId = clientUser.id;
          token.picture      = profile.picture;
        } catch (err) {
          console.error('NextAuth JWT callback error:', err.message);
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.clientUserId = token.clientUserId;
      session.user.picture = token.picture;
      return session;
    },
  },

  pages: {
    signIn: '/portal/login',
  },
};
