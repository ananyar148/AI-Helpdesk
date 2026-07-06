'use client';

/**
 * WorkLogPanel
 * Displays all work logs for a ticket and allows team members/admins to add new ones.
 * Clients only see logs with visibility = "Client".
 */

import { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

const VISIBILITY_OPTIONS = [
  { value: 'Internal', label: 'Internal (team only)', color: 'bg-orange-100 text-orange-700' },
];

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function WorkLogPanel({ ticketId, workLogs: initialLogs, canAddLog = false }) {
  const [logs,       setLogs]       = useState(initialLogs || []);
  const [note,       setNote]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res  = await fetch(`/api/tickets/${ticketId}/work-logs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ note: note.trim(), visibility: 'Internal' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add work log');

      setLogs((prev) => [...prev, data.workLog]);
      setNote('');
      setSuccess('Work log added.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Log list */}
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No work logs yet.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {logs.map((log) => {
            const visCfg = VISIBILITY_OPTIONS.find((v) => v.value === log.visibility)
              || VISIBILITY_OPTIONS[0];
            return (
              <div key={log.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {log.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{log.userName}</span>
                    {log.team && (
                      <span className="text-xs text-gray-400">({log.team})</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${visCfg.color}`}>
                      {log.visibility}
                    </span>
                  </div>
                  <time className="text-xs text-gray-400 flex-shrink-0">{formatTime(log.createdAt)}</time>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{log.note}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add log form — only for authenticated team/admin */}
      {canAddLog && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Add Work Log</p>

          {error   && <p className="alert-error text-sm mb-3">{error}</p>}
          {success && <p className="alert-success text-sm mb-3">{success}</p>}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Describe what was investigated, fixed, or tested…"
            className="input-field resize-none mb-3 text-sm"
            disabled={submitting}
          />

          <button
            type="submit"
            disabled={submitting || !note.trim()}
            className="btn-primary text-sm"
          >
            {submitting ? <><LoadingSpinner size="sm" /> Adding…</> : 'Add Work Log'}
          </button>
        </form>
      )}
    </div>
  );
}
