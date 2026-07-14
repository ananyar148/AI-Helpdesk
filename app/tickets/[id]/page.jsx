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
import { StatusBadge, PriorityBadge, CategoryBadge, TeamsDisplay, TeamBadge } from '../../components/StatusBadge';

const STATUS_OPTIONS       = ['Open', 'In Progress', 'Resolved'];
const STATUS_OPTIONS_ADMIN = ['Open', 'In Progress', 'Resolved', 'Signed Off'];
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
  const [allUsers,   setAllUsers]   = useState([]);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  // Multi-team picker state (admin only)
  const [selectedTeams, setSelectedTeams] = useState([]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);

  // Lightbox for attachments
  const [lightbox, setLightbox] = useState(null); // { dataUrl, fileName, mimeType }

  // Close lightbox on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Request more details modal
  const [showDetailsModal,  setShowDetailsModal]  = useState(false);
  const [detailsMessage,    setDetailsMessage]    = useState('');
  const [sendingDetails,    setSendingDetails]    = useState(false);
  const [detailsError,      setDetailsError]      = useState('');
  const [detailsSuccess,    setDetailsSuccess]    = useState('');

  // Auth
  useEffect(() => {
    fetch('/api/team-auth/me')
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

      // Fetch assignable users (admin only — best effort)
      try {
        const usersRes  = await fetch('/api/users/active');
        const usersData = await usersRes.json();
        if (usersRes.ok) setAllUsers(usersData.users || []);
      } catch { /* non-critical */ }
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
    (user.role === 'TeamMember' && (
      teams.includes(user.team) ||          // team-based access
      ticket.assignedToId === user.id        // individually assigned
    ))
  );
  const canDelete  = user?.role === 'Admin';
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
          <span className="text-gray-800 font-medium truncate max-w-[220px]">
            #{String(ticket?.ticketNumber ?? '').padStart(3, '0')} · {ticket?.subject}
          </span>
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
                    <span className="font-mono text-sm font-semibold text-gray-400">
                      #{String(ticket.ticketNumber ?? '').padStart(3, '0')}
                    </span>
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
                {(canAccess && ticket.clientEmail && user.role === 'Admin') || canDelete ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Request Details — admin only */}
                    {canAccess && ticket.clientEmail && user.role === 'Admin' && (
                      <button onClick={() => { setShowDetailsModal(true); setDetailsError(''); setDetailsSuccess(''); }}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                        </svg>
                        Request Details
                      </button>
                    )}
                    {/* Delete — admin only */}
                    {canDelete && (
                      <button onClick={() => setShowDeleteConfirm(true)}
                        className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5" disabled={deleting}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              <p className="text-sm text-gray-700 leading-relaxed mb-4">{ticket.description}</p>

              {/* Attachments */}
              {ticket.attachments?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Attachments ({ticket.attachments.length})
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {ticket.attachments.map((att) => (
                      <div key={att.id} className="group relative">
                        {att.mimeType?.startsWith('image/') ? (
                          <button type="button" onClick={() => setLightbox(att)} className="block text-left">
                            <img
                              src={att.dataUrl}
                              alt={att.fileName}
                              className="w-28 h-28 object-cover rounded-lg border border-gray-200 hover:border-blue-400 transition-colors shadow-sm cursor-zoom-in"
                            />
                            <p className="text-xs text-gray-400 mt-1 max-w-[112px] truncate">{att.fileName}</p>
                          </button>
                        ) : (
                          <button type="button" onClick={() => setLightbox(att)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-gray-700">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                            </svg>
                            <span className="max-w-[140px] truncate">{att.fileName}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {(att.sizeBytes / 1024).toFixed(0)} KB
                            </span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

            {/* Unified Timeline */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Timeline
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {activities.length + workLogs.length} entries · newest first
                </span>
              </h2>
              <ActivityTimeline
                activities={activities}
                workLogs={workLogs}
                ticketId={id}
                canAddLog={canAddLog}
                onLogAdded={(newLog) => {
                  setWorkLogs((prev) => [...prev, newLog]);
                  // Also refresh activities so the work_log_added event appears
                  fetch(`/api/tickets/${id}/activity`)
                    .then(r => r.json())
                    .then(d => { if (d.activities) setActivities(d.activities); });
                }}
              />
            </div>
          </div>

          {/* ── Right: Controls ───────────────────────────────────────────── */}
          <div className="space-y-4">

            <div className="card">
              <label className="input-label">Status</label>
              <select value={ticket.status}
                onChange={(e) => handleUpdate('status', e.target.value)}
                disabled={updating || (ticket.status === 'Signed Off' && user?.role !== 'Admin')}
                className="input-field mt-1">
                {(user?.role === 'Admin' ? STATUS_OPTIONS_ADMIN : STATUS_OPTIONS).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {ticket.status === 'Signed Off' && user?.role !== 'Admin' && (
                <p className="text-xs text-amber-600 mt-1">Only an admin can change the status of a signed-off ticket.</p>
              )}
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

            {/* Assign to individual — Admin only */}
            {user.role === 'Admin' && (
              <div className="card">
                <label className="input-label mb-2 block">Assigned To</label>
                <select
                  value={ticket.assignedToId ?? ''}
                  disabled={updating}
                  onChange={async (e) => {
                    const val = e.target.value || null;
                    setUpdating(true);
                    try {
                      const res  = await fetch(`/api/tickets/${id}`, {
                        method:  'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ assignedToId: val }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed');
                      setTicket(data.ticket);
                      setSuccess('Assigned successfully.');
                      const aRes  = await fetch(`/api/tickets/${id}/activity`);
                      const aData = await aRes.json();
                      if (aRes.ok) setActivities(aData.activities);
                      setTimeout(() => setSuccess(''), 3000);
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setUpdating(false);
                    }
                  }}
                  className="input-field mt-1 text-sm"
                >
                  <option value="">— Unassigned —</option>
                  {Object.entries(
                    allUsers.reduce((acc, u) => {
                      const t = u.team || 'Other';
                      if (!acc[t]) acc[t] = [];
                      acc[t].push(u);
                      return acc;
                    }, {})
                  ).map(([team, members]) => (
                    <optgroup key={team} label={team}>
                      {members.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {/* Meta */}
            <div className="card bg-gray-50 border-gray-200 text-xs text-gray-500 space-y-1.5">
              <p><span className="font-medium text-gray-600">Category:</span> {ticket.category}</p>
              {ticket.clientEmail && (
                <p><span className="font-medium text-gray-600">Client:</span>{' '}
                  <span className="break-all">{ticket.clientEmail}</span>
                </p>
              )}
              <div className="flex items-start gap-1 flex-wrap">
                <span className="font-medium text-gray-600">Teams:</span>
                <TeamsDisplay assignedTeams={teams} />
              </div>

              {/* Assigned To */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="font-medium text-gray-600">Assigned To:</span>
                {ticket.assignedTo ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-200 text-blue-800 inline-flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {ticket.assignedTo.name.charAt(0).toUpperCase()}
                    </span>
                    {ticket.assignedTo.name}
                    {ticket.assignedTo.team && <span className="text-blue-400 font-normal">· {ticket.assignedTo.team}</span>}
                  </span>
                ) : (
                  <span className="text-gray-400 italic">Unassigned</span>
                )}
              </div>
              {ticket.isDuplicate && (
                <p className="text-pink-600 font-medium">⚠ Marked as duplicate</p>
              )}

              {/* Classification metadata */}
              {ticket.classificationSource && (
                <div className="pt-1.5 mt-1.5 border-t border-gray-200 space-y-1.5">
                  <p className="font-medium text-gray-600 uppercase tracking-wide text-xs">Classification</p>

                  {/* Source badge */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-gray-600">Source:</span>
                    {(() => {
                      const src = ticket.classificationSource;
                      const cfg = {
                        'vertex-ai':          { label: '🤖 Vertex AI',        color: 'bg-indigo-100 text-indigo-700' },
                        'custom+vertex-draft':{ label: '⚡ Custom + AI Draft', color: 'bg-blue-100 text-blue-700'   },
                        'custom-fallback':    { label: '📐 Rule-based',        color: 'bg-gray-100 text-gray-600'   },
                        'cache':              { label: '🗄️ Cached',             color: 'bg-teal-100 text-teal-700'  },
                      }[src] || { label: src, color: 'bg-gray-100 text-gray-600' };
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Confidence bar */}
                  {ticket.confidenceScore != null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-600">Confidence:</span>
                        <span className={`font-semibold text-xs ${
                          ticket.confidenceScore >= 0.7  ? 'text-green-600' :
                          ticket.confidenceScore >= 0.4  ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          {ticket.confidenceScore === 0
                            ? 'N/A'
                            : `${Math.round(ticket.confidenceScore * 100)}%`}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            ticket.confidenceScore >= 0.7  ? 'bg-green-500' :
                            ticket.confidenceScore >= 0.4  ? 'bg-amber-400' : 'bg-gray-300'
                          }`}
                          style={{ width: `${Math.max(Math.round(ticket.confidenceScore * 100), 2)}%` }}
                        />
                      </div>
                      <p className="text-gray-400 mt-1">
                        {ticket.confidenceScore === 0
                          ? 'No rule matched — Vertex AI classified fully'
                          : ticket.confidenceScore >= 0.7
                          ? 'High — rule-based classifier was confident'
                          : ticket.confidenceScore >= 0.4
                          ? 'Medium — AI used for full classification'
                          : 'Low — AI used for full classification'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={() => setLightbox(null)}
          role="dialog" aria-modal="true" aria-label={lightbox.fileName}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}>

            {/* Top bar */}
            <div className="w-full flex items-center justify-between mb-3 px-1">
              <p className="text-sm text-white/80 truncate max-w-[80%]">{lightbox.fileName}
                <span className="ml-2 text-white/40 text-xs">
                  {(lightbox.sizeBytes / 1024).toFixed(0)} KB
                </span>
              </p>
              <div className="flex items-center gap-2">
                {/* Download button */}
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = lightbox.dataUrl;
                    a.download = lightbox.fileName;
                    a.click();
                  }}
                  className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                  title="Download">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Download
                </button>
                {/* Close button */}
                <button
                  onClick={() => setLightbox(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/30 text-white transition-colors"
                  title="Close (Esc)">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Image or file preview */}
            {lightbox.mimeType?.startsWith('image/') ? (
              <img
                src={lightbox.dataUrl}
                alt={lightbox.fileName}
                className="max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain"
              />
            ) : (
              <div className="bg-white rounded-xl p-8 text-center shadow-2xl">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p className="text-gray-700 font-medium mb-1">{lightbox.fileName}</p>
                <p className="text-gray-400 text-sm mb-4">{(lightbox.sizeBytes / 1024).toFixed(0)} KB</p>
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = lightbox.dataUrl;
                    a.download = lightbox.fileName;
                    a.click();
                  }}
                  className="btn-primary text-sm">
                  Download File
                </button>
              </div>
            )}

            <p className="text-white/30 text-xs mt-3">Click outside or press Esc to close</p>
          </div>
        </div>
      )}

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
