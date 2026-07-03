'use client';

/**
 * ActivityTimeline — chronological audit trail for a ticket.
 *
 * Each entry displays:
 *   Icon  |  Action label           [timestamp]
 *          |  Detail: "Ram (Development) changed status to In Progress"
 *          |  Before → After values
 *          |  by Ram · Development team
 */

const ACTION_CONFIG = {
  created:            { icon: '🎫', label: 'Ticket Created',       color: 'bg-blue-100 text-blue-700' },
  status_updated:     { icon: '🔄', label: 'Status Updated',       color: 'bg-yellow-100 text-yellow-700' },
  priority_changed:   { icon: '⚡', label: 'Priority Changed',     color: 'bg-orange-100 text-orange-700' },
  team_reassigned:    { icon: '👥', label: 'Team Reassigned',      color: 'bg-purple-100 text-purple-700' },
  ai_draft_generated: { icon: '🤖', label: 'AI Draft Generated',   color: 'bg-indigo-100 text-indigo-700' },
  work_log_added:     { icon: '📝', label: 'Work Log Added',       color: 'bg-teal-100 text-teal-700' },
  ticket_updated:     { icon: '✏️', label: 'Ticket Updated',       color: 'bg-gray-100 text-gray-700' },
  ticket_deleted:     { icon: '🗑️', label: 'Ticket Deleted',       color: 'bg-red-100 text-red-700' },
  duplicate_detected: { icon: '🔁', label: 'Duplicate Detected',   color: 'bg-pink-100 text-pink-700' },
};

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Build the attribution line shown under each activity entry.
 * Output examples:
 *   "Ram · Development team"
 *   "Admin User · Admin"
 *   "System / AI"
 */
function actorLine(activity) {
  if (!activity.userName) return 'System / AI';

  const parts = [activity.userName];

  // Prefer team over role for the context label
  if (activity.userTeam) {
    parts.push(`${activity.userTeam} team`);
  } else if (activity.userRole) {
    parts.push(activity.userRole);
  }

  return parts.join(' · ');
}

export default function ActivityTimeline({ activities = [] }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, idx) => {
          const cfg    = ACTION_CONFIG[activity.action] || {
            icon: '📋', label: activity.action, color: 'bg-gray-100 text-gray-700',
          };
          const isLast = idx === activities.length - 1;

          return (
            <li key={activity.id}>
              <div className="relative pb-8">
                {/* Connector line */}
                {!isLast && (
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true" />
                )}

                <div className="relative flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center
                    justify-center text-sm ${cfg.color}`}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
                      <time className="text-xs text-gray-400 flex-shrink-0">
                        {formatTime(activity.createdAt)}
                      </time>
                    </div>

                    {/* Detail sentence — already contains "Name (Team) did X" */}
                    {activity.detail && (
                      <p className="text-sm text-gray-700 mt-0.5 leading-snug">
                        {activity.detail}
                      </p>
                    )}

                    {/* Before → After values */}
                    {(activity.oldValue || activity.newValue) && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        {activity.oldValue && (
                          <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 line-through font-medium">
                            {activity.oldValue}
                          </span>
                        )}
                        {activity.oldValue && activity.newValue && (
                          <span className="text-gray-400 font-bold">→</span>
                        )}
                        {activity.newValue && (
                          <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 font-semibold">
                            {activity.newValue}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Attribution: "Ram · Development team" */}
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      {activity.userName ? (
                        <>
                          <span className="inline-flex items-center justify-center w-4 h-4
                            rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">
                            {activity.userName.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-gray-500">{actorLine(activity)}</span>
                        </>
                      ) : (
                        <span className="italic">System / AI</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
