'use client';

/**
 * Ticket Detail Page — /tickets/[id]
 * Shows full ticket info, activity timeline, and delete option.
 * Accessible to TeamMembers (own team) and Admins.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import ActivityTimeline from '../../components/ActivityTimeline';
import { StatusBadge, PriorityBadge, CategoryBadge, TeamBadge } from '../../components/StatusBadge';

const STATUS_OPTIONS  = ['Open', 'In Progress', 'Resolved'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
const TEAM_OPTIONS    = ['Development', 'Billing', 'HR', 'Support'];

export default function TicketDetailPage() {
  const router   = useRouter();
  const { id }   = useParams();

  const [user,       setUser]       = useState(null);
  const [ticket,     setTicket]     = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [updating,   setUpdating]   = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  // Delete confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);

  // Fetch user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (d.user) setUser(d.user); else router.push('/login'); })
      .catch(() => router.push('/login'));
  }, [router]);

  // Fetch ticket + activities
  const fetchTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`/api/tickets/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load ticket');
      setTicket(data.ticket);
      setActivities(data.ticket.activities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  // Update field (status / assignedTeam / priority)
  const handleUpdate = async (field, value) => {
    if (!ticket || value === ticket[field]) return;
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const res  = await fetch(`/api/tickets/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setTicket(data.ticket);
      setSuccess(`${field === 'status' ? 'Status' : field === 'assignedTeam' ? 'Team' : 'Priority'} updated successfully.`);
      // Refresh activities
      const aRes  = await fetch(`/api/tickets/${id}/activity`);
      const aData = await aRes.json();
      if (aRes.ok) setActivities(aData.activities);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Delete ticket
  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const res  = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      router.push(user?.role === 'Admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const canDelete = user && (user.role === 'Admin' ||
    (user.role === 'TeamMember' && ticket && ticket.assignedTeam === user.team));

  const formatDate = (d) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link
            href={user.role === 'Admin' ? '/admin' : '/dashboard'}
            className="hover:text-blue-600 transition-colors"
          >
            {user.role === 'Admin' ? 'Admin Dashboard' : 'My Dashboard'}
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-medium truncate max-w-[200px]">{ticket?.subject}</span>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert-error mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="alert-success mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left: Ticket Details ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Header card */}
            <div className="card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{ticket.subject}</h1>
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex-shrink-0 btn-danger text-xs px-3 py-1.5"
                    disabled={deleting}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-700 leading-relaxed mb-5">{ticket.description}</p>

              <div className="flex flex-wrap gap-2">
                <StatusBadge   status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <CategoryBadge category={ticket.category} />
                <TeamBadge     team={ticket.assignedTeam} />
              </div>

              <p className="text-xs text-gray-400 mt-4">
                Created {formatDate(ticket.createdAt)}
                {ticket.updatedAt !== ticket.createdAt &&
                  ` · Updated ${formatDate(ticket.updatedAt)}`}
              </p>
            </div>

            {/* AI Draft Response */}
            {ticket.draftResponse && (
              <div className="card border-blue-200 bg-blue-50">
                <p className="text-xs font-semibold text-blue-600 uppercase mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  AI Draft Response
                </p>
                <p className="text-sm text-gray-700 italic">{ticket.draftResponse}</p>
              </div>
            )}

            {/* Activity Timeline */}
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Activity History
                <span className="text-xs font-normal text-gray-400">({activities.length} events)</span>
              </h2>
              <ActivityTimeline activities={activities} />
            </div>
          </div>

          {/* ── Right: Update Controls ────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Status */}
            <div className="card">
              <label className="input-label">Status</label>
              <select
                value={ticket.status}
                onChange={(e) => handleUpdate('status', e.target.value)}
                disabled={updating}
                className="input-field mt-1"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div className="card">
              <label className="input-label">Priority</label>
              <select
                value={ticket.priority}
                onChange={(e) => handleUpdate('priority', e.target.value)}
                disabled={updating}
                className="input-field mt-1"
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Reassign — admin only */}
            {user.role === 'Admin' && (
              <div className="card">
                <label className="input-label">Assigned Team</label>
                <select
                  value={ticket.assignedTeam}
                  onChange={(e) => handleUpdate('assignedTeam', e.target.value)}
                  disabled={updating}
                  className="input-field mt-1"
                >
                  {TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            {updating && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <LoadingSpinner size="sm" /> Saving…
              </div>
            )}

            {/* Ticket meta */}
            <div className="card bg-gray-50 border-gray-200 text-xs text-gray-500 space-y-1">
              <p><span className="font-medium text-gray-600">ID:</span> <span className="font-mono">{ticket.id}</span></p>
              <p><span className="font-medium text-gray-600">Category:</span> {ticket.category}</p>
              <p><span className="font-medium text-gray-600">Team:</span> {ticket.assignedTeam}</p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 id="delete-title" className="font-semibold text-gray-900">Delete Ticket?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm text-gray-700">
              <span className="font-medium">"{ticket.subject}"</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger flex-1"
              >
                {deleting ? <><LoadingSpinner size="sm" /> Deleting…</> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
