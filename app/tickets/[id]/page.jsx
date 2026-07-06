'use client';

/**
 * Ticket Detail Page — /tickets/[id]
 * Shows full ticket info, work logs, activity timeline, and delete option.
 * Accessible to TeamMembers (any assigned team) and Admins.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import ActivityTimeline from '../../components/ActivityTimeline';
import WorkLogPanel from '../../components/WorkLogPanel';
import { StatusBadge, PriorityBadge, CategoryBadge, TeamsDisplay, TeamBadge } from '../../components/StatusBadge';

const STATUS_OPTIONS   = ['Open', 'In Progress', 'Resolved'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
const TEAM_OPTIONS     = ['Development', 'Billing', 'HR', 'Support'];

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [user,       setUser]       = useState(null);
  const [ticket,     setTicket]     = useState(null);
  const [activities, setActivities] = useState([]);
  const [workLogs,   setWorkLogs]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [updating,   setUpdating]   = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [activeTab,  setActiveTab]  = useState('worklogs');

  // Multi-team picker state (admin only)
  const [selectedTeams, setSelectedTeams] = useState([]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);

  // Request more details modal
  const [showDetailsModal,  setShowDetailsModal]  = useState(false);
  const [detailsMessage,    setDetailsMessage]    = useState('');
  const [sendingDetails,    setSendingDetails]    = useState(false);
  const [detailsError,      setDetailsError]      = useState('');
  const [detailsSuccess,    setDetailsSuccess]    = useState('');

  // Auth
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (d.user) setUser(d.user); else router.push('/login'); })
      .catch(() => router.push('/login'));
  }, [router]);

  // Fetch ticket + activities + work logs
  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [ticketRes, workLogRes] = await Promise.all([
        fetch(`/api/tickets/${id}`),
        fetch(`/api/tickets/${id}/work-logs`),
      ]);

      const ticketData  = await ticketRes.json();
      const workLogData = await workLogRes.json();

      if (!ticketRes.ok) throw new Error(ticketData.error || 'Failed to load ticket');

      setTicket(ticketData.ticket);
      setActivities(ticketData.ticket.activities || []);
      setWorkLogs(workLogData.workLogs || []);
      setSelectedTeams(ticketData.ticket.assignedTeams || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Update a single field (status, priority)
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
      setSuccess('Updated successfully.');
      const aRes  = await fetch(`/api/tickets/${id}/activity`);
      const aData = await aRes.json();
      if (aRes.ok) setActivities(aData.activities);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Save multi-team selection
  const handleTeamsSave = async () => {
    if (selectedTeams.length === 0) { setError('Select at least one team.'); return; }
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const res  = await fetch(`/api/tickets/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ assignedTeams: selectedTeams }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setTicket(data.ticket);
      setSelectedTeams(data.ticket.assignedTeams);
      setSuccess('Teams updated.');
      const aRes  = await fetch(`/api/tickets/${id}/activity`);
      const aData = await aRes.json();
      if (aRes.ok) setActivities(aData.activities);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const toggleTeam = (team) =>
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );

  const teamsChanged = ticket
    ? JSON.stringify([...selectedTeams].sort()) !== JSON.stringify([...(ticket.assignedTeams || [])].sort())
    : false;

  // Delete
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

  // Send "request more details" email to client
  const handleRequestDetails = async () => {
    if (!detailsMessage.trim() || detailsMessage.trim().length < 10) {
      setDetailsError('Please enter at least 10 characters.'); return;
    }
    setSendingDetails(true);
    setDetailsError('');
    try {
      const res  = await fetch(`/api/tickets/${id}/request-details`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: detailsMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setDetailsSuccess(data.message);
      setDetailsMessage('');
      // Refresh activity timeline
      const aRes  = await fetch(`/api/tickets/${id}/activity`);
      const aData = await aRes.json();
      if (aRes.ok) setActivities(aData.activities);
      setTimeout(() => { setDetailsSuccess(''); setShowDetailsModal(false); }, 2500);
    } catch (err) {
      setDetailsError(err.message);
    } finally {
      setSendingDetails(false);
    }
  };

  const teams     = ticket?.assignedTeams || [];
  const canAccess = user && ticket && (
    user.role === 'Admin' ||
    (user.role === 'TeamMember' && teams.includes(user.team))
  );
  const canDelete  = canAccess;
  const canAddLog  = canAccess;

  const formatDate = (d) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
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
          <Link href={user.role === 'Admin' ? '/admin' : '/dashboard'}
            className="hover:text-blue-600 transition-colors">
            {user.role === 'Admin' ? 'Admin Dashboard' : 'My Dashboard'}
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-medium truncate max-w-[220px]">{ticket?.subject}</span>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert-error mb-4 flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>{error}
          </div>
        )}
        {success && <div className="alert-success mb-4 text-sm">{success}</div>}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left ──────────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Header card */}
            <div className="card">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
                    {ticket.isDuplicate && (
                      <span className="badge bg-pink-100 text-pink-700 flex items-center gap-1">
                        🔁 Duplicate
                        {ticket.similarityScore && ` (${Math.round(ticket.similarityScore * 100)}%)`}
                      </span>
                    )}
                  </div>
                  {ticket.isDuplicate && ticket.duplicateOfId && (
                    <p className="text-xs text-gray-500 mb-2">
                      Linked to original:{' '}
                      <Link href={`/tickets/${ticket.duplicateOfId}`}
                        className="text-blue-600 hover:underline font-mono">{ticket.duplicateOfId}</Link>
                    </p>
                  )}
                </div>
                {canDelete && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ticket.clientEmail && (
                      <button onClick={() => { setShowDetailsModal(true); setDetailsError(''); setDetailsSuccess(''); }}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                        </svg>
                        Request Details
                      </button>
                    )}
                    <button onClick={() => setShowDeleteConfirm(true)}
                      className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5" disabled={deleting}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-700 leading-relaxed mb-4">{ticket.description}</p>

              <div className="flex flex-wrap gap-2">
                <StatusBadge   status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <CategoryBadge category={ticket.category} />
                <TeamsDisplay  assignedTeams={teams} />
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Created {formatDate(ticket.createdAt)}
                {ticket.updatedAt !== ticket.createdAt &&
                  ` · Updated ${formatDate(ticket.updatedAt)}`}
              </p>
            </div>

            {/* AI Draft */}
            {ticket.draftResponse && (
              <div className="card border-blue-200 bg-blue-50">
                <p className="text-xs font-semibold text-blue-600 uppercase mb-2 flex items-center gap-1">
                  🤖 AI Draft Response
                </p>
                <p className="text-sm text-gray-700 italic">{ticket.draftResponse}</p>
              </div>
            )}

            {/* Tabs */}
            <div className="card">
              <div className="flex gap-1 mb-5 border-b border-gray-100 pb-3">
                {[
                  { key: 'worklogs', label: `Work Logs (${workLogs.length})` },
                  { key: 'activity', label: `Activity (${activities.length})` },
                ].map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'worklogs' && (
                <WorkLogPanel ticketId={id} workLogs={workLogs} canAddLog={canAddLog} />
              )}
              {activeTab === 'activity' && (
                <ActivityTimeline activities={activities} />
              )}
            </div>
          </div>

          {/* ── Right: Controls ───────────────────────────────────────────── */}
          <div className="space-y-4">

            <div className="card">
              <label className="input-label">Status</label>
              <select value={ticket.status}
                onChange={(e) => handleUpdate('status', e.target.value)}
                disabled={updating} className="input-field mt-1">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="card">
              <label className="input-label">Priority</label>
              <select value={ticket.priority}
                onChange={(e) => handleUpdate('priority', e.target.value)}
                disabled={updating} className="input-field mt-1">
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Multi-team assignment — Admin only */}
            {user.role === 'Admin' && (
              <div className="card">
                <label className="input-label mb-2 block">Assigned Teams</label>
                <div className="space-y-2 mb-3">
                  {TEAM_OPTIONS.map((t) => (
                    <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes(t)}
                        onChange={() => toggleTeam(t)}
                        className="accent-blue-600 w-4 h-4"
                        disabled={updating}
                      />
                      <TeamBadge team={t} />
                    </label>
                  ))}
                </div>
                {teamsChanged && (
                  <button
                    onClick={handleTeamsSave}
                    disabled={updating || selectedTeams.length === 0}
                    className="btn-primary text-sm w-full"
                  >
                    {updating ? <><LoadingSpinner size="sm" /> Saving…</> : 'Save Teams'}
                  </button>
                )}
                {selectedTeams.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">At least one team required.</p>
                )}
              </div>
            )}

            {updating && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <LoadingSpinner size="sm" /> Saving…
              </div>
            )}

            {/* Meta */}
            <div className="card bg-gray-50 border-gray-200 text-xs text-gray-500 space-y-1.5">
              <p><span className="font-medium text-gray-600">ID:</span>{' '}
                <span className="font-mono break-all">{ticket.id}</span></p>
              <p><span className="font-medium text-gray-600">Category:</span> {ticket.category}</p>
              <div className="flex items-start gap-1 flex-wrap">
                <span className="font-medium text-gray-600">Teams:</span>
                <TeamsDisplay assignedTeams={teams} />
              </div>
              {ticket.isDuplicate && (
                <p className="text-pink-600 font-medium">⚠ Marked as duplicate</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Request Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Request More Details</h3>
                <p className="text-sm text-gray-500">
                  An email will be sent to <span className="font-medium text-gray-700">{ticket.clientEmail}</span>
                </p>
              </div>
            </div>

            {detailsError   && <p className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{detailsError}</p>}
            {detailsSuccess && <p className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{detailsSuccess}</p>}

            {!detailsSuccess && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Message to client <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={detailsMessage}
                    onChange={e => setDetailsMessage(e.target.value)}
                    rows={5}
                    placeholder="e.g. Could you please provide the exact error message you see? Also, which browser and OS are you using?"
                    className="input-field resize-none text-sm"
                    disabled={sendingDetails}
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{detailsMessage.length} chars</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowDetailsModal(false)} disabled={sendingDetails}
                    className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleRequestDetails} disabled={sendingDetails || detailsMessage.trim().length < 10}
                    className="btn-primary flex-1">
                    {sendingDetails ? <><LoadingSpinner size="sm" /> Sending…</> : 'Send Email'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Ticket?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm text-gray-700">
              <span className="font-medium">"{ticket.subject}"</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? <><LoadingSpinner size="sm" /> Deleting…</> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
