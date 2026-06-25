'use client';

/**
 * Team Dashboard — /dashboard
 * Protected. Shows only tickets assigned to the logged-in user's team.
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

  // Fetch current user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!data.user) {
          router.push('/login');
          return;
        }
        // Admins should use /admin
        if (data.user.role === 'Admin') {
          router.push('/admin');
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // Fetch tickets for this team
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

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Apply client-side filters
  useEffect(() => {
    let result = [...tickets];
    if (filters.status) result = result.filter((t) => t.status === filters.status);
    if (filters.category) result = result.filter((t) => t.category === filters.category);
    if (filters.priority) result = result.filter((t) => t.priority === filters.priority);
    setFilteredTickets(result);
  }, [tickets, filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
              <h1 className="text-2xl font-bold text-gray-900">Team Dashboard</h1>
              {user.team && <TeamBadge team={user.team} />}
            </div>
            <p className="text-gray-500 text-sm">
              Welcome back, <span className="font-medium text-gray-700">{user.name}</span>.
              {user.team
                ? ` Showing tickets assigned to the ${user.team} team.`
                : ' Showing all assigned tickets.'}
            </p>
          </div>
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="btn-secondary self-start sm:self-auto"
            aria-label="Refresh tickets"
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
            <p className="text-gray-500 text-sm">Loading tickets…</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mb-8">
              <StatsCards tickets={tickets} />
            </div>

            {/* Filters + Table */}
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Tickets
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({filteredTickets.length}{filteredTickets.length !== tickets.length ? ` of ${tickets.length}` : ''})
                  </span>
                </h2>
                <FilterBar
                  filters={filters}
                  onChange={handleFilterChange}
                  isAdmin={false}
                />
              </div>

              <TicketTable tickets={filteredTickets} isAdmin={false} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
