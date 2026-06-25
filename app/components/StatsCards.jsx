'use client';

/**
 * StatsCards — summary statistics row for dashboards.
 */
export default function StatsCards({ tickets }) {
  const total = tickets.length;
  const open = tickets.filter((t) => t.status === 'Open').length;
  const inProgress = tickets.filter((t) => t.status === 'In Progress').length;
  const resolved = tickets.filter((t) => t.status === 'Resolved').length;
  const highPriority = tickets.filter((t) => t.priority === 'High').length;

  const stats = [
    {
      label: 'Total Tickets',
      value: total,
      icon: '🎫',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Open',
      value: open,
      icon: '📬',
      color: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'In Progress',
      value: inProgress,
      icon: '⚙️',
      color: 'bg-yellow-50 text-yellow-600',
    },
    {
      label: 'Resolved',
      value: resolved,
      icon: '✅',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'High Priority',
      value: highPriority,
      icon: '🔴',
      color: 'bg-red-50 text-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="card py-4 px-5">
          <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-lg mb-2 ${stat.color}`}>
            <span>{stat.icon}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
