'use client';

/**
 * Settings Page — /settings
 * Allows logged-in users to change their password.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Auth check
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!data.user) { router.push('/login'); return; }
        setUser(data.user);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setStatus('error');
      setMessage('New password must be at least 8 characters.');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Failed to change password.');
        return;
      }

      setStatus('success');
      setMessage(data.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  // Password strength indicator
  const getStrength = (pwd) => {
    if (!pwd) return null;
    if (pwd.length < 8) return { label: 'Too short', color: 'bg-red-400', width: 'w-1/4' };
    if (pwd.length < 10) return { label: 'Weak', color: 'bg-orange-400', width: 'w-2/4' };
    if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return { label: 'Fair', color: 'bg-yellow-400', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  };

  const strength = getStrength(newPassword);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your account preferences</p>
        </div>

        {/* Profile Info Card */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{user.name}</p>
              <p className="text-gray-500 text-sm">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge bg-blue-100 text-blue-700">{user.role}</span>
                {user.team && (
                  <span className="badge bg-gray-100 text-gray-600">{user.team} Team</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Choose a strong password you don't use anywhere else.
          </p>

          {/* Success alert */}
          {status === 'success' && (
            <div className="alert-success mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {message}
            </div>
          )}

          {/* Error alert */}
          {status === 'error' && (
            <div className="alert-error mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Show/hide toggle */}
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {showPasswords ? (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>Hide passwords</>
                ) : (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>Show passwords</>
                )}
              </button>
            </div>

            {/* Current Password */}
            <div className="mb-4">
              <label htmlFor="current" className="input-label">Current Password</label>
              <input
                id="current"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your current password"
                required
                disabled={status === 'loading'}
                autoComplete="current-password"
              />
            </div>

            {/* New Password */}
            <div className="mb-2">
              <label htmlFor="new" className="input-label">New Password</label>
              <input
                id="new"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setStatus('idle'); }}
                className="input-field"
                placeholder="At least 8 characters"
                required
                disabled={status === 'loading'}
                autoComplete="new-password"
              />
              {/* Strength bar */}
              {strength && (
                <div className="mt-2">
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                  </div>
                  <p className={`text-xs mt-1 ${
                    strength.label === 'Strong' ? 'text-green-600' :
                    strength.label === 'Fair' ? 'text-yellow-600' : 'text-red-500'
                  }`}>{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="mb-6 mt-4">
              <label htmlFor="confirm" className="input-label">Confirm New Password</label>
              <input
                id="confirm"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setStatus('idle'); }}
                className={`input-field ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-400 focus:ring-red-400'
                    : confirmPassword && confirmPassword === newPassword
                    ? 'border-green-400 focus:ring-green-400'
                    : ''
                }`}
                placeholder="Re-enter new password"
                required
                disabled={status === 'loading'}
                autoComplete="new-password"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
              {confirmPassword && confirmPassword === newPassword && (
                <p className="text-xs text-green-600 mt-1">Passwords match ✓</p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                status === 'loading' ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword
              }
              className="btn-primary w-full py-2.5"
            >
              {status === 'loading' ? (
                <><LoadingSpinner size="sm" /> Updating password…</>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Go back
          </button>
        </div>
      </main>
    </div>
  );
}
