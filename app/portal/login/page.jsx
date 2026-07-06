'use client';

/**
 * Client Portal Login — /portal/login
 * Google sign-in only. After auth, redirects to /portal/dashboard.
 */

import { signIn, useSession } from 'next-auth/react';
import { useRouter }          from 'next/navigation';
import { useEffect }          from 'react';
import Link                   from 'next/link';
import LoadingSpinner         from '../../components/LoadingSpinner';

export default function PortalLoginPage() {
  const { status } = useSession();
  const router     = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/portal/dashboard');
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">HelpDesk</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sign in to submit tickets and track your support requests
          </p>
        </div>

        {/* Card */}
        <div className="card shadow-md">
          <p className="text-sm text-gray-600 mb-6 text-center leading-relaxed">
            Use your Google account to sign in. All tickets submitted with your Google email
            will appear in your dashboard automatically.
          </p>

          <button
            onClick={() => signIn('google', { callbackUrl: '/portal/dashboard' })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            We only use your name and email to identify your tickets. Nothing else is stored.
          </p>
        </div>

        <div className="mt-5 space-y-2 text-center">
          <p className="text-sm text-gray-500">
            Team member?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Team login →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
