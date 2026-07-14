'use client';

/**
 * Team Dashboard — /dashboard
 * Tickets split into two sections:
 *   1. Assigned to Me  — tickets where assignedToId === this user's id
 *   2. Team Queue      — tickets on the team's queue with no individual assignee
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import TicketTable from '../components/TicketTable';
import StatsCards from '../components/StatsCards';
import FilterBar from '../components/FilterBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { TeamBadge } from '../components/StatusBadge';

export default function DashboardPage() {
  const router = useRouter();
  const [user,            setUser]            = useState(null);
  const [tickets,         setTickets]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [filters,         setFilters]         = useState({ status: '', category: '', priority: '' });

  // Fetch current user
  useEffect(() => {
    fetch('/api/team-auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!data.user) { router.push('/login'); return; }
        if (data.user.role === 'Admin') { router.push('/admin'); return; }
        setUser(data.user);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/tickets');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tickets');
      setTickets(data.tickets);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleTicketDeleted = (deletedId) =>
    setTickets((prev) => prev.filter((t) => t.id !== deletedId));

  const handleFilterChange = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  // ── Split tickets ──────────────────────────────────────────────────────────
  const applyFilters = (list) => {
    let r = [...list];
    if (filters.status)   r = r.filter((t) => t.status   === filters.status);
    if (filters.category) r = r.filter((t) => t.category === filters.category);
    if (filters.priority) r = r.filter((t) => t.priority === filters.priority);
    return r;
  };

  const assignedToMe   = user ? applyFilters(tickets.filter((t) => t.assignees?.some(a => a.userId === user.id))) : [];
  const teamQueue      = user ? applyFilters(tickets.filter((t) => !t.assignees?.length)) : [];
  const hasFilters     = !!(filters.status || filters.category || filters.priority);
  const clearFilters   = () => setFilters({ status: '', category: '', priority: '' });

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">Team Dashboard</h1>
              {user.team && <TeamBadge team={user.team} />}
            </div>
            <p className="text-gray-500 text-sm">
              Welcome back, <span className="font-medium text-gray-700">{user.name}</span>.
              {user.team ? ` Showing tickets for the ${user.team} team.` : ' Showing all assigned tickets.'}
            </p>
          </div>
          <button onClick={fetchTickets} disabled={loading}
            className="btn-secondary self-start sm:self-auto" aria-label="Refresh tickets">
            {loading ? <LoadingSpinner size="sm" /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            )}
            Refresh
          </button>
        </div>

        {error && (
          <div className="alert-error mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            {error}
            <button onClick={fetchTickets} className="ml-auto text-xs underline">Retry</button>
          </div>
        )}

        {loading && tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-gray-500 text-sm">Loading tickets…</p>
          </div>
        ) : (
          <>
            {/* Stats — based on all tickets this user can see */}
            <div className="mb-8">
              <StatsCards tickets={tickets} />
            </div>

            {/* Shared filter bar */}
            <div className="flex justify-end mb-4">
              <FilterBar filters={filters} onChange={handleFilterChange} isAdmin={false} />
            </div>

            {/* ── Section 1: Assigned to Me ──────────────────────────────── */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-semibold text-gray-900">
                  Assigned to Me
                </h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  ${assignedToMe.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  {assignedToMe.length}
                </span>
                {assignedToMe.length > 0 && (
                  <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Action required
                  </span>
                )}
              </div>

              <div className="card">
                <TicketTable
                  tickets={assignedToMe}
                  isAdmin={false}
                  userRole={user.role}
                  userTeam={user.team}
                  hasActiveFilters={hasFilters}
                  onClearFilters={clearFilters}
                  onTicketDeleted={handleTicketDeleted}
                />
              </div>
            </div>

            {/* ── Section 2: Team Queue (unassigned) ────────────────────── */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-semibold text-gray-900">
                  {user.team ? `${user.team} Team Queue` : 'Team Queue'}
                </h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  ${teamQueue.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                  {teamQueue.length}
                </span>
                <span className="text-xs text-gray-400">Unassigned — available to any team member</span>
              </div>

              <div className="card">
                <TicketTable
                  tickets={teamQueue}
                  isAdmin={false}
                  userRole={user.role}
                  userTeam={user.team}
                  hasActiveFilters={hasFilters}
                  onClearFilters={clearFilters}
                  onTicketDeleted={handleTicketDeleted}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
