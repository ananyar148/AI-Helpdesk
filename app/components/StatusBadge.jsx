'use client';

/**
 * StatusBadge — colour-coded pill for ticket status.
 */
export function StatusBadge({ status }) {
  const map = {
    Open: 'badge-open',
    'In Progress': 'badge-in-progress',
    Resolved: 'badge-resolved',
  };
  return (
    <span className={map[status] || 'badge bg-gray-100 text-gray-600'}>
      {status}
    </span>
  );
}

/**
 * PriorityBadge — colour-coded pill for ticket priority.
 */
export function PriorityBadge({ priority }) {
  const map = {
    High: 'priority-high',
    Medium: 'priority-medium',
    Low: 'priority-low',
  };
  return (
    <span className={map[priority] || 'badge bg-gray-100 text-gray-600'}>
      {priority}
    </span>
  );
}

/**
 * CategoryBadge — colour-coded pill for ticket category.
 */
export function CategoryBadge({ category }) {
  const colorMap = {
    Billing: 'bg-emerald-100 text-emerald-700',
    Bug: 'bg-red-100 text-red-700',
    'Feature Request': 'bg-indigo-100 text-indigo-700',
    HR: 'bg-pink-100 text-pink-700',
    Other: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`badge ${colorMap[category] || 'bg-gray-100 text-gray-600'}`}>
      {category}
    </span>
  );
}

/**
 * TeamBadge — colour-coded pill for assigned team.
 */
export function TeamBadge({ team }) {
  const colorMap = {
    Development: 'bg-blue-100 text-blue-700',
    Billing: 'bg-emerald-100 text-emerald-700',
    HR: 'bg-pink-100 text-pink-700',
    Support: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`badge ${colorMap[team] || 'bg-gray-100 text-gray-600'}`}>
      {team}
    </span>
  );
}
