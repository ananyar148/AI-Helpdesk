'use client';

import { SessionProvider } from 'next-auth/react';

// NextAuth basePath points to our custom client-auth route
export default function ClientSessionProvider({ children }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
