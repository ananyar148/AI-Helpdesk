'use client';

/**
 * ActivityTimeline — unified chronological timeline for a ticket.
 * Shows the first PAGE_SIZE entries inside a fixed-height scrollable box.
 * An IntersectionObserver sentinel at the bottom of that box triggers
 * loading the next batch as the user scrolls — true infinite scroll.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';

const PAGE_SIZE      = 5;   // entries revealed per scroll batch
const CONTAINER_HEIGHT = 520; // px — height of the scrollable timeline box

const ACTION_CONFIG = {
  created:            { icon: '🎫', label: 'Ticket Created',      color: 'bg-blue-100 text-blue-700'    },
  status_updated:     { icon: '🔄', label: 'Status Updated',      color: 'bg-yellow-100 text-yellow-700'},
  priority_changed:   { icon: '⚡', label: 'Priority Changed',    color: 'bg-orange-100 text-orange-700'},
  category_changed:   { icon: '🏷️', label: 'Category Changed',    color: 'bg-violet-100 text-violet-700'},
  teams_updated:      { icon: '👥', label: 'Teams Updated',       color: 'bg-purple-100 text-purple-700'},
  team_reassigned:    { icon: '👥', label: 'Team Reassigned',     color: 'bg-purple-100 text-purple-700'},
  ai_draft_generated: { icon: '🤖', label: 'AI Draft Generated',  color: 'bg-indigo-100 text-indigo-700'},
  work_log_added:     { icon: '📝', label: 'Work Log Added',      color: 'bg-teal-100 text-teal-700'   },
  ticket_updated:     { icon: '✏️',  label: 'Ticket Updated',      color: 'bg-gray-100 text-gray-700'   },
  ticket_deleted:     { icon: '🗑️',  label: 'Ticket Deleted',      color: 'bg-red-100 text-red-700'     },
  duplicate_detected: { icon: '🔁', label: 'Duplicate Detected',  color: 'bg-pink-100 text-pink-700'   },
  details_requested:  { icon: '📧', label: 'Details Requested',   color: 'bg-amber-100 text-amber-700' },
  details_provided:   { icon: '💬', label: 'Details Provided',    color: 'bg-green-100 text-green-700' },
  follow_up_added:    { icon: '↩️',  label: 'Follow-up Added',     color: 'bg-blue-100 text-blue-700'   },
  work_log:           { icon: '📝', label: 'Work Log',            color: 'bg-teal-100 text-teal-700'   },
};

const MESSAGE_ACTIONS = new Set(['details_requested', 'details_provided', 'follow_up_added']);

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function actorLine(entry) {
  if (entry._type === 'worklog') {
    const parts = [];
    if (entry.team)     parts.push(entry.team);
    if (entry.userRole) parts.push(entry.userRole);
    return { name: entry.userName, context: parts.join(' · '), role: entry.userRole };
  }
  if (!entry.userName) return { name: null, context: '', role: null };
  const parts = [];
  if (entry.userTeam) parts.push(entry.userTeam);
  if (entry.userRole) parts.push(entry.userRole);
  return { name: entry.userName, context: parts.join(' · '), role: entry.userRole };
}

// ── Single timeline entry ─────────────────────────────────────────────────────
function TimelineEntry({ entry, isLast }) {
  const isWorklog = entry._type === 'worklog';
  const cfg = isWorklog
    ? ACTION_CONFIG.work_log
    : (ACTION_CONFIG[entry.action] || { icon: '📋', label: entry.action, color: 'bg-gray-100 text-gray-700' });

  return (
    <li>
      <div className="relative pb-8">
        {!isLast && (
          <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
        )}
        <div className="relative flex items-start gap-3">
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${cfg.color}`}>
            {cfg.icon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
                {isWorklog && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    entry.visibility === 'Internal' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>{entry.visibility}</span>
                )}
              </div>
              <time className="text-xs text-gray-400 flex-shrink-0">{formatTime(entry.createdAt)}</time>
            </div>

            {isWorklog && (
              <p className="text-sm text-gray-700 mt-1 leading-snug whitespace-pre-wrap">{entry.note}</p>
            )}
            {!isWorklog && entry.detail && (
              <p className="text-sm text-gray-700 mt-0.5 leading-snug">{entry.detail}</p>
            )}

            {!isWorklog && entry.action === 'details_requested' && entry.newValue && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Message sent to client</p>
                <p className="text-sm text-amber-900 leading-snug">{entry.newValue}</p>
              </div>
            )}
            {!isWorklog && entry.action === 'details_provided' && entry.newValue && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs font-semibold text-green-700 uppercase mb-1">Details from client</p>
                <p className="text-sm text-green-900 leading-snug">{entry.newValue}</p>
              </div>
            )}
            {!isWorklog && entry.action === 'follow_up_added' && entry.newValue && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Client message</p>
                <p className="text-sm text-blue-900 leading-snug">{entry.newValue}</p>
              </div>
            )}

            {!isWorklog && !MESSAGE_ACTIONS.has(entry.action) && (entry.oldValue || entry.newValue) && (
              <div className="flex items-center gap-2 mt-1.5 text-xs">
                {entry.oldValue && (
                  <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 line-through font-medium">{entry.oldValue}</span>
                )}
                {entry.oldValue && entry.newValue && <span className="text-gray-400 font-bold">→</span>}
                {entry.newValue && (
                  <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 font-semibold">{entry.newValue}</span>
                )}
              </div>
            )}

            <p className="text-xs mt-1 flex items-center gap-1.5 flex-wrap">
              {(() => {
                const actor = actorLine(entry);
                if (!actor.name) return <span className="italic text-gray-400">System / AI</span>;
                const isAdmin     = actor.role === 'Admin';
                const avatarColor = isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
                const badgeColor  = isAdmin ? 'bg-purple-50 text-purple-600'  : 'bg-blue-50 text-blue-600';
                return (
                  <>
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold flex-shrink-0 ${avatarColor}`}>
                      {actor.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium text-gray-600">{actor.name}</span>
                    {actor.context && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badgeColor}`}>
                        {actor.context}
                      </span>
                    )}
                  </>
                );
              })()}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ActivityTimeline({
  activities = [],
  workLogs   = [],
  ticketId,
  canAddLog  = false,
  onLogAdded,
}) {
  const [note,       setNote]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');
  const [formOk,     setFormOk]     = useState('');

  // Merge and sort all entries newest-first
  const merged = [
    ...activities.map(a => ({ ...a, _type: 'activity', _ts: new Date(a.createdAt).getTime() })),
    ...workLogs.map(w   => ({ ...w, _type: 'worklog',  _ts: new Date(w.createdAt).getTime() })),
  ].sort((a, b) => b._ts - a._ts);

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollBoxRef  = useRef(null); // the bounded scroll container
  const sentinelRef   = useRef(null); // invisible div at bottom of list
  const hasMore       = visibleCount < merged.length;

  // Reset when data changes (new log added → scroll back to top, show fresh)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (scrollBoxRef.current) scrollBoxRef.current.scrollTop = 0;
  }, [activities.length, workLogs.length]);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + PAGE_SIZE, merged.length));
  }, [merged.length]);

  // Observer uses scrollBoxRef as root so it only triggers when the sentinel
  // enters the SCROLL BOX viewport, not the page viewport
  useEffect(() => {
    const sentinel  = sentinelRef.current;
    const scrollBox = scrollBoxRef.current;
    if (!sentinel || !scrollBox || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { root: scrollBox, rootMargin: '0px', threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // ── Work log form ─────────────────────────────────────────────────────────
  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    setFormError('');
    setFormOk('');
    try {
      const res  = await fetch(`/api/tickets/${ticketId}/work-logs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ note: note.trim(), visibility: 'Internal' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add work log');
      setNote('');
      setFormOk('Work log added.');
      setTimeout(() => setFormOk(''), 3000);
      onLogAdded?.(data.workLog);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const visible = merged.slice(0, visibleCount);

  return (
    <div>
      {/* Add work log form — outside the scroll box */}
      {canAddLog && (
        <form onSubmit={handleAddLog} className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Add Work Log</p>
          {formError && <p className="text-sm text-red-600 mb-2">{formError}</p>}
          {formOk    && <p className="text-sm text-green-600 mb-2">{formOk}</p>}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Describe what was investigated, fixed, or tested…"
            className="input-field resize-none mb-3 text-sm"
            disabled={submitting}
          />
          <button type="submit" disabled={submitting || !note.trim()} className="btn-primary text-sm">
            {submitting ? <><LoadingSpinner size="sm" /> Adding…</> : 'Add Work Log'}
          </button>
        </form>
      )}

      {merged.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No activity recorded yet.</div>
      ) : (
        <>
          {/* Counter */}
          <p className="text-xs text-gray-400 mb-3">
            Showing {Math.min(visibleCount, merged.length)} of {merged.length} entries
            {hasMore && ' — scroll down to load more'}
          </p>

          {/* ── Bounded scroll container — IntersectionObserver root ── */}
          <div
            ref={scrollBoxRef}
            style={{ height: CONTAINER_HEIGHT }}
            className="overflow-y-auto pr-1 scrollbar-thin"
          >
            <ul className="-mb-8">
              {visible.map((entry, idx) => (
                <TimelineEntry
                  key={`${entry._type}-${entry.id}`}
                  entry={entry}
                  isLast={idx === visible.length - 1 && !hasMore}
                />
              ))}
            </ul>

            {/* Sentinel sits inside the scroll box — only visible when user scrolls near the bottom */}
            {hasMore ? (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center gap-2 py-4 text-xs text-gray-400"
              >
                <LoadingSpinner size="sm" />
                <span>Loading more…</span>
              </div>
            ) : (
              merged.length > PAGE_SIZE && (
                <p className="text-center text-xs text-gray-300 py-4">
                  All {merged.length} entries shown
                </p>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
