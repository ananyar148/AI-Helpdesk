'use client';

/**
 * TicketTable component
 * - Rows link to /tickets/[id] (detail + activity page)
 * - Status dropdown: TeamMember (own team) + Admin
 * - Reassign dropdown: Admin only
 * - Delete button: TeamMember (own team) + Admin, with confirmation dialog
 * - Optimistic overrides for status/team changes
 */

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge, CategoryBadge, TeamBadge } from './StatusBadge';
import LoadingSpinner from './LoadingSpinner';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved'];
const TEAM_OPTIONS   = ['Development', 'Billing', 'HR', 'Support'];

export default function TicketTable({
  tickets,
  isAdmin        = false,
  userTeam       = null,   // current user's team (null for Admin)
  userRole       = null,   // 'Admin' | 'TeamMember'
  onTicketDeleted,         // callback(ticketId) so parent can remove from list
  onClearFilters,
  hasActiveFilters = false,
}) {
  const [overrides,  setOverrides]  = useState({});
  const [updating,   setUpdating]   = useState(null);
  const [error,      setError]      = useState('');

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(null); // ticket object
  const [deleting,      setDeleting]      = useState(false);

  const merge = (ticket) => ({ ...ticket, ...(overrides[ticket.id] || {}) });

  // Can this user delete this ticket?
  const canDelete = (ticket) => {
    if (userRole === 'Admin') return true;
    if (userRole === 'TeamMember' && userTeam && ticket.assignedTeam === userTeam) return true;
    return false;
  };

  const handleStatusChange = async (ticketId, newStatus, e) => {
    e.stopPropagation();
    setUpdating(ticketId);
    setError('');
    try {
      const res  = await fetch(`/api/tickets/${ticketId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setOverrides((prev) => ({ ...prev, [ticketId]: { ...prev[ticketId], status: newStatus } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleTeamChange = async (ticketId, newTeam, e) => {
    e.stopPropagation();
    setUpdating(ticketId);
    setError('');
    try {
      const res  = await fetch(`/api/tickets/${ticketId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ assignedTeam: newTeam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reassign');
      setOverrides((prev) => ({ ...prev, [ticketId]: { ...prev[ticketId], assignedTeam: newTeam } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      const res  = await fetch(`/api/tickets/${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      if (onTicketDeleted) onTicketDeleted(confirmDelete.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  // ── Empty state ────────────────────────────────────────────────────────
  if (!tickets || tickets.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {hasActiveFilters ? (
          <>
            <p className="font-medium text-gray-700">No tickets match your filters</p>
            <p className="text-sm mt-1 mb-4 text-gray-500">Try adjusting or clearing your filters.</p>
            {onClearFilters && (
              <button onClick={onClearFilters} className="btn-primary text-sm">Clear all filters</button>
            )}
          </>
        ) : (
          <>
            <p className="font-medium">No tickets found</p>
            <p className="text-sm mt-1">Tickets will appear here when submitted.</p>
          </>
        )}
      </div>
    );
  }

  // Number of columns for colspan calculation
  const colCount = isAdmin ? 8 : 7; // +1 for Reassign, +1 for Delete always

  return (
    <>
      {error && (
        <div className="alert-error mb-4 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Desktop Table ──────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
              <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Team</th>
              <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              {isAdmin && (
                <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reassign</th>
              )}
              <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.map((rawTicket) => {
              const ticket   = merge(rawTicket);
              const showDel  = canDelete(ticket);

              return (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors group">
                  {/* Subject — links to detail page */}
                  <td className="py-3 pr-4">
                    <Link href={`/tickets/${ticket.id}`} className="block group-hover:text-blue-600">
                      <div className="font-medium text-gray-900 truncate max-w-[200px] group-hover:text-blue-600" title={ticket.subject}>
                        {ticket.subject}
                      </div>
                      <div className="text-xs text-gray-400 truncate max-w-[200px] mt-0.5">
                        {ticket.description.substring(0, 55)}…
                      </div>
                    </Link>
                  </td>

                  <td className="py-3 pr-4"><CategoryBadge category={ticket.category} /></td>
                  <td className="py-3 pr-4"><TeamBadge     team={ticket.assignedTeam} /></td>
                  <td className="py-3 pr-4"><PriorityBadge priority={ticket.priority} /></td>

                  {/* Status dropdown */}
                  <td className="py-3 pr-4">
                    {updating === ticket.id ? <LoadingSpinner size="sm" /> : (
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value, e)}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                        aria-label={`Status for ${ticket.subject}`}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>

                  {/* Reassign (admin only) */}
                  {isAdmin && (
                    <td className="py-3 pr-4">
                      {updating === ticket.id ? <LoadingSpinner size="sm" /> : (
                        <select
                          value={ticket.assignedTeam}
                          onChange={(e) => handleTeamChange(ticket.id, e.target.value, e)}
                          className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                          aria-label={`Reassign ${ticket.subject}`}
                        >
                          {TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      )}
                    </td>
                  )}

                  <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(ticket.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="View details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      {showDel && (
                        <button
                          onClick={() => setConfirmDelete(ticket)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete ticket"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ──────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-4">
        {tickets.map((rawTicket) => {
          const ticket  = merge(rawTicket);
          const showDel = canDelete(ticket);
          return (
            <div key={ticket.id} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link href={`/tickets/${ticket.id}`}
                  className="font-medium text-gray-900 text-sm hover:text-blue-600">{ticket.subject}</Link>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{ticket.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <CategoryBadge category={ticket.category} />
                <TeamBadge     team={ticket.assignedTeam} />
                <PriorityBadge priority={ticket.priority} />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(ticket.id, e.target.value, e)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white flex-1"
                  disabled={updating === ticket.id}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {isAdmin && (
                  <select
                    value={ticket.assignedTeam}
                    onChange={(e) => handleTeamChange(ticket.id, e.target.value, e)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white flex-1"
                    disabled={updating === ticket.id}
                  >
                    {TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                <Link href={`/tickets/${ticket.id}`}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 border border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                {showDel && (
                  <button onClick={() => setConfirmDelete(ticket)}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 border border-red-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Ticket?</h3>
                <p className="text-sm text-gray-500">This cannot be undone.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm text-gray-700">
              <span className="font-medium">"{confirmDelete.subject}"</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="btn-secondary flex-1"
              >Cancel</button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                className="btn-danger flex-1"
              >
                {deleting ? <><LoadingSpinner size="sm" /> Deleting…</> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
