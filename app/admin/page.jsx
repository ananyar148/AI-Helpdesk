'use client';

/**
 * Admin Dashboard — /admin
 * Protected (Admin only). Full access to all tickets with filtering and reassignment.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import TicketTable from '../components/TicketTable';
import StatsCards from '../components/StatsCards';
import FilterBar from '../components/FilterBar';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    team: '',
  });

  // AI status
  const [aiStatus, setAiStatus] = useState(null);
  const [aiChecking, setAiChecking] = useState(false);

  // Auth check
  useEffect(() => {
    fetch('/api/team-auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!data.user || data.user.role !== 'Admin') {
          router.push('/login');
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // Fetch ALL tickets
  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tickets');
      setTickets(data.tickets);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkAiStatus = async () => {
    setAiChecking(true);
    try {
      const res  = await fetch('/api/admin/ai-status');
      const data = await res.json();
      setAiStatus(data);
    } catch {
      setAiStatus({ status: 'error', message: 'Could not reach the status endpoint.' });
    } finally {
      setAiChecking(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Client-side filtering
  useEffect(() => {
    let result = [...tickets];
    if (filters.status) result = result.filter((t) => t.status === filters.status);
    if (filters.category) result = result.filter((t) => t.category === filters.category);
    if (filters.priority) result = result.filter((t) => t.priority === filters.priority);
    if (filters.team) result = result.filter((t) =>
      (t.assignedTeams ?? (t.assignedTeam ? [t.assignedTeam] : [])).includes(filters.team)
    );
    setFilteredTickets(result);
  }, [tickets, filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Team distribution breakdown
  const teamBreakdown = () => {
    const teams = ['Development', 'Billing', 'HR', 'Support'];
    return teams.map((team) => ({
      team,
      count: tickets.filter((t) =>
        (t.assignedTeams || (t.assignedTeam ? [t.assignedTeam] : [])).includes(team)
      ).length,
    }));
  };

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
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <span className="badge bg-purple-100 text-purple-700">Admin</span>
            </div>
            <p className="text-gray-500 text-sm">
              Welcome, <span className="font-medium text-gray-700">{user.name}</span>. Full access to all tickets across all teams.
            </p>
          </div>
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="btn-secondary self-start sm:self-auto"
          >
            {loading ? <LoadingSpinner size="sm" /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
        </div>

        {error && (
          <div className="alert-error mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
            <button onClick={fetchTickets} className="ml-auto text-xs underline">Retry</button>
          </div>
        )}

        {loading && tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-gray-500 text-sm">Loading all tickets…</p>
          </div>
        ) : (
          <>
            {/* AI Status */}
            <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  !aiStatus            ? 'bg-gray-300' :
                  aiStatus.status === 'connected' ? 'bg-green-500 animate-pulse' :
                  'bg-red-400'
                }`} />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Vertex AI (Gemini)
                    {aiStatus && (
                      <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                        aiStatus.status === 'connected'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {aiStatus.status === 'connected' ? '✓ Connected' : aiStatus.status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </p>
                  {aiStatus && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {aiStatus.status === 'connected'
                        ? `${aiStatus.model} · ${aiStatus.location} · ${aiStatus.latencyMs}ms`
                        : aiStatus.message?.substring(0, 100)}
                    </p>
                  )}
                  {!aiStatus && <p className="text-xs text-gray-400">Click to check AI classification status</p>}
                </div>
              </div>
              <button onClick={checkAiStatus} disabled={aiChecking}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                {aiChecking ? (
                  <><LoadingSpinner size="sm" /> Checking…</>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Check Status
                  </>
                )}
              </button>
            </div>

            {/* Stats */}
            <div className="mb-6">
              <StatsCards tickets={tickets} />
            </div>

            {/* Team Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {teamBreakdown().map(({ team, count }) => {
                const colorMap = {
                  Development: 'border-blue-200 bg-blue-50',
                  Billing: 'border-emerald-200 bg-emerald-50',
                  HR: 'border-pink-200 bg-pink-50',
                  Support: 'border-orange-200 bg-orange-50',
                };
                const textMap = {
                  Development: 'text-blue-700',
                  Billing: 'text-emerald-700',
                  HR: 'text-pink-700',
                  Support: 'text-orange-700',
                };
                return (
                  <button
                    key={team}
                    onClick={() => handleFilterChange('team', filters.team === team ? '' : team)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      filters.team === team
                        ? colorMap[team] + ' ring-2 ring-offset-1 ring-current'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-2xl font-bold ${filters.team === team ? textMap[team] : 'text-gray-900'}`}>
                      {count}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{team} Team</p>
                  </button>
                );
              })}
            </div>

            {/* Filters + Table */}
            <div className="card">
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    All Tickets
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({filteredTickets.length}{filteredTickets.length !== tickets.length ? ` of ${tickets.length}` : ''})
                    </span>
                  </h2>
                </div>
                <FilterBar
                  filters={filters}
                  onChange={handleFilterChange}
                  isAdmin={true}
                />
              </div>

              <TicketTable
                tickets={filteredTickets}
                isAdmin={true}
                userRole={user.role}
                userTeam={user.team}
                hasActiveFilters={!!(filters.status || filters.category || filters.priority || filters.team)}
                onClearFilters={() => setFilters({ status: '', category: '', priority: '', team: '' })}
                onTicketDeleted={(deletedId) => {
                  setTickets((prev) => prev.filter((t) => t.id !== deletedId));
                }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
