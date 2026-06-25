'use client';

/**
 * FilterBar — filter controls for dashboards.
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

  const activeCount = [filters.status, filters.category, filters.priority, filters.team]
    .filter(Boolean).length;

  // Active filter gets a highlighted border so the user knows it's set
  const selectClass = (value) =>
    `text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition-colors ${
      value
        ? 'border-2 border-blue-500 text-blue-700 font-medium'
        : 'border border-gray-200 text-gray-700'
    }`;

  const clearAll = () => {
    onChange('status', '');
    onChange('category', '');
    onChange('priority', '');
    onChange('team', '');
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Label with active count badge */}
      <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
        Filter:
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
            {activeCount}
          </span>
        )}
      </span>

      <select
        value={filters.status}
        onChange={(e) => onChange('status', e.target.value)}
        className={selectClass(filters.status)}
        aria-label="Filter by status"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>{s || 'All Statuses'}</option>
        ))}
      </select>

      <select
        value={filters.category}
        onChange={(e) => onChange('category', e.target.value)}
        className={selectClass(filters.category)}
        aria-label="Filter by category"
      >
        {categories.map((c) => (
          <option key={c} value={c}>{c || 'All Categories'}</option>
        ))}
      </select>

      <select
        value={filters.priority}
        onChange={(e) => onChange('priority', e.target.value)}
        className={selectClass(filters.priority)}
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
          className={selectClass(filters.team)}
          aria-label="Filter by team"
        >
          {teams.map((t) => (
            <option key={t} value={t}>{t || 'All Teams'}</option>
          ))}
        </select>
      )}

      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
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
