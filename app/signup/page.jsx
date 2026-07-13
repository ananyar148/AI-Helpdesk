'use client';

/**
 * Team member signup page — /signup?token=xxx
 * Validates the invite token and lets the new user set their password.
 * On success, logs them in and redirects to their dashboard.
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams }    from 'next/navigation';
import Link                              from 'next/link';
import LoadingSpinner                    from '../components/LoadingSpinner';

function SignupForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token');

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [tokenOk,   setTokenOk]   = useState(null); // null=checking, true, false
  const [userName,  setUserName]  = useState('');

  // Verify the token exists and is valid before showing the form
  useEffect(() => {
    if (!token) { setTokenOk(false); return; }
    fetch(`/api/team-auth/verify-invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setTokenOk(true); setUserName(d.name || ''); }
        else         { setTokenOk(false); setError(d.error || 'Invalid or expired invite link.'); }
      })
      .catch(() => { setTokenOk(false); setError('Could not verify invite link.'); });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.'); return;
    }

    setLoading(true);
    try {
      const res  = await fetch('/api/team-auth/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Signup failed.'); return; }

      // Redirect based on role
      router.push(data.user.role === 'Admin' ? '/admin' : '/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">HelpDesk</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Set your password</h1>
          <p className="text-gray-500 text-sm mt-1">
            {userName ? `Welcome, ${userName}!` : 'Complete your account setup to get started.'}
          </p>
        </div>

        <div className="card shadow-md">
          {/* Loading token verification */}
          {tokenOk === null && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
              <LoadingSpinner size="sm" /> Verifying invite link…
            </div>
          )}

          {/* Invalid token */}
          {tokenOk === false && (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </div>
              <p className="text-red-600 font-medium mb-1">Invalid invite link</p>
              <p className="text-sm text-gray-500">{error || 'This link has expired or already been used.'}</p>
              <p className="text-sm text-gray-400 mt-3">Contact your admin to send a new invite.</p>
            </div>
          )}

          {/* Valid token — show form */}
          {tokenOk === true && (
            <>
              {error && (
                <div className="alert-error mb-4 flex items-start gap-2 text-sm">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                  <label htmlFor="password" className="input-label">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="input-field pr-10"
                      required
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d={showPw
                            ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
                            : 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                          }/>
                      </svg>
                    </button>
                  </div>
                  {/* Password strength hint */}
                  {password.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {[4, 8, 12].map((threshold, i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length >= threshold ? 'bg-green-400' : 'bg-gray-200'
                        }`} />
                      ))}
                      <span className="text-xs text-gray-400 ml-1">
                        {password.length < 8 ? 'Too short' : password.length < 12 ? 'Good' : 'Strong'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label htmlFor="confirm" className="input-label">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="confirm"
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className={`input-field ${confirm && confirm !== password ? 'border-red-300 focus:ring-red-400' : ''}`}
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  {confirm && confirm !== password && (
                    <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="btn-primary w-full py-3"
                >
                  {loading ? <><LoadingSpinner size="sm" /> Setting up account…</> : 'Set Password & Sign In'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
