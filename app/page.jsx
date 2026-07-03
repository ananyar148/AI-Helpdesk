'use client';

/**
 * Client Portal — /
 * Two-phase submission:
 *   Phase 1: Check for duplicates (POST /api/tickets/check-duplicate)
 *   Phase 2a: Duplicate found → show warning with "View Existing" or "Create Anyway"
 *   Phase 2b: No duplicate → create ticket (POST /api/tickets)
 */

import { useState } from 'react';
import Link from 'next/link';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';

const MAX_SUBJECT     = 150;
const MAX_DESCRIPTION = 2000;

// Submission phases
const PHASE = {
  IDLE:      'idle',
  CHECKING:  'checking',   // checking for duplicates
  DUPLICATE: 'duplicate',  // duplicate warning shown
  CREATING:  'creating',   // creating ticket
  SUCCESS:   'success',
  ERROR:     'error',
};

export default function ClientPortal() {
  const [subject,     setSubject]     = useState('');
  const [description, setDescription] = useState('');
  const [phase,       setPhase]       = useState(PHASE.IDLE);
  const [message,     setMessage]     = useState('');
  const [ticket,      setTicket]      = useState(null);

  // Duplicate warning state
  const [dupInfo,          setDupInfo]          = useState(null); // { existingTicket, score }
  const [preClassification,setPreClassification] = useState(null);

  // ── Phase 1: Check for duplicates ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setPhase(PHASE.CHECKING);
    setMessage('');

    try {
      const res  = await fetch('/api/tickets/check-duplicate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subject: subject.trim(), description: description.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to check for duplicates');

      if (data.isDuplicate && data.existingTicket) {
        // Show duplicate warning
        setDupInfo({ existingTicket: data.existingTicket, score: data.score });
        setPreClassification(data.classification);
        setPhase(PHASE.DUPLICATE);
        return;
      }

      // No duplicate — proceed directly to create
      await createTicket({ preClassification: data.classification });
    } catch (err) {
      setPhase(PHASE.ERROR);
      setMessage(err.message || 'Network error. Please try again.');
    }
  };

  // ── Phase 2: Create ticket ─────────────────────────────────────────────────
  const createTicket = async ({
    forceCreate       = false,
    duplicateOfId     = null,
    similarityScore   = null,
    preClassification = null,
  } = {}) => {
    setPhase(PHASE.CREATING);
    setMessage('');

    try {
      const res  = await fetch('/api/tickets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject:          subject.trim(),
          description:      description.trim(),
          forceCreate,
          duplicateOfId,
          similarityScore,
          preClassification,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Shouldn't happen after check, but handle 409 just in case
        if (res.status === 409 && data.existingTicket) {
          setDupInfo({ existingTicket: data.existingTicket, score: data.score });
          setPhase(PHASE.DUPLICATE);
          return;
        }
        throw new Error(data.error || 'Something went wrong.');
      }

      setTicket(data.ticket);
      setPhase(PHASE.SUCCESS);
      setMessage(data.message);
      setSubject('');
      setDescription('');
      setDupInfo(null);
      setPreClassification(null);
    } catch (err) {
      setPhase(PHASE.ERROR);
      setMessage(err.message);
    }
  };

  const handleReset = () => {
    setPhase(PHASE.IDLE);
    setMessage('');
    setTicket(null);
    setDupInfo(null);
    setPreClassification(null);
  };

  const isLoading = phase === PHASE.CHECKING || phase === PHASE.CREATING;

  // ── Success ──────────────────────────────────────────────────────────────
  if (phase === PHASE.SUCCESS && ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
          <div className="card border-green-200 bg-green-50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-1">Ticket Submitted!</h3>
                <p className="text-sm text-green-700 mb-4">{message}</p>

                {ticket.isDuplicate && (
                  <div className="alert-info mb-4 text-xs flex items-center gap-2">
                    🔁 This ticket was submitted as a duplicate
                    {ticket.similarityScore &&
                      ` (${Math.round(ticket.similarityScore * 100)}% similar to an existing ticket)`}.
                  </div>
                )}

                <div className="bg-white rounded-lg p-4 border border-green-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-medium">Ticket ID</span>
                      <p className="font-mono text-gray-800 text-xs mt-0.5 truncate">{ticket.id}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-medium">Assigned To</span>
                      <p className="font-medium text-gray-800 mt-0.5">{ticket.assignedTeam} Team</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-medium">Category</span>
                      <p className="font-medium text-gray-800 mt-0.5">{ticket.category}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-medium">Priority</span>
                      <p className={`font-medium mt-0.5 ${
                        ticket.priority === 'High'   ? 'text-red-600' :
                        ticket.priority === 'Medium' ? 'text-orange-600' : 'text-gray-600'
                      }`}>{ticket.priority}</p>
                    </div>
                  </div>

                  {ticket.draftResponse && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs uppercase font-medium text-blue-600 mb-1">🤖 AI Draft Response</p>
                      <p className="text-sm text-gray-700 italic">{ticket.draftResponse}</p>
                    </div>
                  )}
                </div>

                <button onClick={handleReset} className="btn-primary mt-4 text-sm">
                  Submit Another Ticket
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-12 sm:py-16">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Support Center</h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Submit your support request and our AI will route it to the right team.
          </p>
        </div>

        {/* ── Duplicate Warning ─────────────────────────────────────────── */}
        {phase === PHASE.DUPLICATE && dupInfo && (
          <div className="card border-orange-200 bg-orange-50 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-lg">
                🔁
              </div>
              <div>
                <h3 className="font-semibold text-orange-900">Similar Ticket Found</h3>
                <p className="text-sm text-orange-700 mt-0.5">
                  A ticket with <strong>{dupInfo.score}% similarity</strong> already exists and is currently{' '}
                  <strong>{dupInfo.existingTicket.status}</strong>.
                </p>
              </div>
            </div>

            {/* Existing ticket preview */}
            <div className="bg-white rounded-lg border border-orange-200 p-4 mb-4 text-sm">
              <p className="font-medium text-gray-900 mb-1">{dupInfo.existingTicket.subject}</p>
              <div className="flex flex-wrap gap-2 text-xs mt-2">
                <span className="badge bg-gray-100 text-gray-600">{dupInfo.existingTicket.status}</span>
                <span className="badge bg-purple-100 text-purple-700">{dupInfo.existingTicket.category}</span>
                <span className="badge bg-blue-100 text-blue-700">{dupInfo.existingTicket.assignedTeam}</span>
                <span className={`badge ${
                  dupInfo.existingTicket.priority === 'High'   ? 'bg-red-100 text-red-700' :
                  dupInfo.existingTicket.priority === 'Medium' ? 'bg-orange-100 text-orange-700' :
                                                                  'bg-gray-100 text-gray-600'
                }`}>{dupInfo.existingTicket.priority}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleReset}
                className="btn-secondary flex-1"
              >
                ← Go Back
              </button>
              <button
                onClick={() => createTicket({
                  forceCreate:      true,
                  duplicateOfId:    dupInfo.existingTicket.id,
                  similarityScore:  dupInfo.score,
                  preClassification,
                })}
                disabled={isLoading}
                className="btn-secondary flex-1 border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Create Anyway'}
              </button>
            </div>
          </div>
        )}

        {/* ── Submission Form ───────────────────────────────────────────── */}
        {phase !== PHASE.DUPLICATE && (
          <div className="card shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Submit a Support Ticket</h2>
            <p className="text-sm text-gray-500 mb-6">
              Describe your issue and our AI will classify and route it to the right team.
            </p>

            {phase === PHASE.ERROR && (
              <div className="alert-error mb-5 text-sm flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-5">
                <label htmlFor="subject" className="input-label">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={MAX_SUBJECT}
                  placeholder="Brief summary of your issue"
                  className="input-field"
                  required
                  disabled={isLoading}
                />
                <div className="flex justify-between mt-1.5">
                  <p className="text-xs text-gray-400">Be specific and concise</p>
                  <p className="text-xs text-gray-400">{subject.length}/{MAX_SUBJECT}</p>
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="description" className="input-label">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={MAX_DESCRIPTION}
                  rows={6}
                  placeholder="What happened, when it started, steps to reproduce…"
                  className="input-field resize-none"
                  required
                  disabled={isLoading}
                />
                <div className="flex justify-between mt-1.5">
                  <p className="text-xs text-gray-400">More detail = faster resolution</p>
                  <p className="text-xs text-gray-400">{description.length}/{MAX_DESCRIPTION}</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !subject.trim() || !description.trim()}
                className="btn-primary w-full py-3"
              >
                {phase === PHASE.CHECKING ? (
                  <><LoadingSpinner size="sm" /> Checking for duplicates…</>
                ) : phase === PHASE.CREATING ? (
                  <><LoadingSpinner size="sm" /> Submitting…</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                    Submit Ticket
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Features */}
        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: '🤖', title: 'AI Classification', desc: 'Auto-routed to the right team' },
            { icon: '🔁', title: 'Duplicate Detection', desc: 'Avoids redundant tickets' },
            { icon: '🔒', title: 'Secure', desc: 'Your data is protected' },
          ].map((f) => (
            <div key={f.title} className="py-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-sm font-medium text-gray-700">{f.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
