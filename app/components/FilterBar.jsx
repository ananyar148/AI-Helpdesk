'use client';

/**
 * FilterBar — filter controls for admin dashboard.
 * Props:
 *   filters: { status, category, priority, team }
 *   onChange: (key, value) => void
 *   isAdmin: boolean
 */
export default function FilterBar({ filters, onChange, isAdmin = false }) {
  const statuses = ['', 'Open', 'In Progress', 'Resolved'];
  const categories = ['', 'Billing', 'Bug', 'Feature Request', 'HR', 'Other'];
  const priorities = ['', 'High', 'Medium', 'Low'];
  const teams = ['', 'Development', 'Billing', 'HR', 'Support'];

  const selectClass =
    'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700';

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <span className="text-sm font-medium text-gray-500">Filter:</span>

      <select
        value={filters.status}
        onChange={(e) => onChange('status', e.target.value)}
        className={selectClass}
        aria-label="Filter by status"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>{s || 'All Statuses'}</option>
        ))}
      </select>

      <select
        value={filters.category}
        onChange={(e) => onChange('category', e.target.value)}
        className={selectClass}
        aria-label="Filter by category"
      >
        {categories.map((c) => (
          <option key={c} value={c}>{c || 'All Categories'}</option>
        ))}
      </select>

      <select
        value={filters.priority}
        onChange={(e) => onChange('priority', e.target.value)}
        className={selectClass}
        aria-label="Filter by priority"
      >
        {priorities.map((p) => (
          <option key={p} value={p}>{p || 'All Priorities'}</option>
        ))}
      </select>

      {isAdmin && (
        <select
          value={filters.team}
          onChange={(e) => onChange('team', e.target.value)}
          className={selectClass}
          aria-label="Filter by team"
        >
          {teams.map((t) => (
            <option key={t} value={t}>{t || 'All Teams'}</option>
          ))}
        </select>
      )}

      {(filters.status || filters.category || filters.priority || filters.team) && (
        <button
          onClick={() => {
            onChange('status', '');
            onChange('category', '');
            onChange('priority', '');
            onChange('team', '');
          }}
          className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear filters
        </button>
      )}
    </div>
  );
}
