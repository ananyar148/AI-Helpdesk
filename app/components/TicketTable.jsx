'use client';

/**
 * TicketTable component
 * Displays a responsive table of tickets with status update controls.
 * Used by both /dashboard and /admin.
 */

import { useState } from 'react';
import { StatusBadge, PriorityBadge, CategoryBadge, TeamBadge } from './StatusBadge';
import LoadingSpinner from './LoadingSpinner';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved'];
const TEAM_OPTIONS = ['Development', 'Billing', 'HR', 'Support'];

export default function TicketTable({ tickets: initialTickets, isAdmin = false, onClearFilters, hasActiveFilters = false }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [updating, setUpdating] = useState(null); // ticket id being updated
  const [expandedId, setExpandedId] = useState(null); // expanded row for draft response
  const [error, setError] = useState('');

  const handleStatusChange = async (ticketId, newStatus) => {
    setUpdating(ticketId);
    setError('');
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');

      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleTeamChange = async (ticketId, newTeam) => {
    setUpdating(ticketId);
    setError('');
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTeam: newTeam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reassign');

      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, assignedTeam: newTeam } : t))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (tickets.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {hasActiveFilters ? (
          <>
            <p className="font-medium text-gray-700">No tickets match your filters</p>
            <p className="text-sm mt-1 mb-4">Try adjusting or clearing your filters to see tickets.</p>
            {onClearFilters && (
              <button
                onClick={onClearFilters}
                className="btn-primary text-sm"
              >
                Clear all filters
              </button>
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

  return (
    <div>
      {error && (
        <div className="alert-error mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Desktop Table */}
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
              <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <>
                <tr
                  key={ticket.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium text-gray-900 truncate max-w-[200px]" title={ticket.subject}>
                      {ticket.subject}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px] mt-0.5">
                      {ticket.description.substring(0, 60)}…
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <CategoryBadge category={ticket.category} />
                  </td>
                  <td className="py-3 pr-4">
                    <TeamBadge team={ticket.assignedTeam} />
                  </td>
                  <td className="py-3 pr-4">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {updating === ticket.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                          aria-label={`Update status for ticket ${ticket.subject}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                      {updating === ticket.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <select
                          value={ticket.assignedTeam}
                          onChange={(e) => handleTeamChange(ticket.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                          aria-label={`Reassign team for ticket ${ticket.subject}`}
                        >
                          {TEAM_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  )}
                  <td className="py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(ticket.createdAt)}
                  </td>
                </tr>

                {/* Expanded row: full description + draft response */}
                {expandedId === ticket.id && (
                  <tr key={`${ticket.id}-expanded`} className="bg-blue-50">
                    <td colSpan={isAdmin ? 7 : 6} className="px-4 py-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Full Description</p>
                          <p className="text-sm text-gray-700">{ticket.description}</p>
                        </div>
                        {ticket.draftResponse && (
                          <div>
                            <p className="text-xs font-semibold text-blue-600 uppercase mb-1 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              AI Draft Response
                            </p>
                            <p className="text-sm text-gray-700 italic">{ticket.draftResponse}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="font-medium text-gray-900 text-sm">{ticket.subject}</h3>
              <StatusBadge status={ticket.status} />
            </div>
            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{ticket.description}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <CategoryBadge category={ticket.category} />
              <TeamBadge team={ticket.assignedTeam} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <div className="flex items-center gap-2">
              {updating === ticket.id ? (
                <LoadingSpinner size="sm" />
              ) : (
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white flex-1"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {isAdmin && (
                <select
                  value={ticket.assignedTeam}
                  onChange={(e) => handleTeamChange(ticket.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white flex-1"
                  disabled={updating === ticket.id}
                >
                  {TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>
            {ticket.draftResponse && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-blue-600 mb-1">AI Draft Response</p>
                <p className="text-xs text-gray-600 italic">{ticket.draftResponse}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
