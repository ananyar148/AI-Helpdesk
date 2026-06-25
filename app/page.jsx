'use client';

/**
 * Client Portal — /
 * Public page where customers submit support tickets.
 */

import { useState } from 'react';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';

const MAX_SUBJECT = 150;
const MAX_DESCRIPTION = 2000;

export default function ClientPortal() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');
  const [ticket, setTicket] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    setTicket(null);

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), description: description.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
      setTicket(data.ticket);
      setMessage(data.message);
      setSubject('');
      setDescription('');
    } catch {
      setStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setMessage('');
    setTicket(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Support Center</h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Submit your support request and our AI will route it to the right team automatically.
          </p>
        </div>

        {/* Success State */}
        {status === 'success' && ticket && (
          <div className="card border-green-200 bg-green-50 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-1">Ticket Submitted!</h3>
                <p className="text-sm text-green-700 mb-4">{message}</p>

                {/* Ticket Details */}
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
                        ticket.priority === 'High' ? 'text-red-600' :
                        ticket.priority === 'Medium' ? 'text-orange-600' : 'text-gray-600'
                      }`}>{ticket.priority}</p>
                    </div>
                  </div>

                  {ticket.draftResponse && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs uppercase font-medium text-blue-600 mb-1 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        AI Draft Response
                      </p>
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
        )}

        {/* Form */}
        {status !== 'success' && (
          <div className="card shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Submit a Support Ticket</h2>
            <p className="text-sm text-gray-500 mb-6">
              Describe your issue and our AI will classify and route it to the right team.
            </p>

            {status === 'error' && (
              <div className="alert-error mb-5 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Subject */}
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
                  disabled={status === 'loading'}
                  aria-describedby="subject-hint"
                />
                <div className="flex justify-between mt-1.5">
                  <p id="subject-hint" className="text-xs text-gray-400">Be specific and concise</p>
                  <p className="text-xs text-gray-400">{subject.length}/{MAX_SUBJECT}</p>
                </div>
              </div>

              {/* Description */}
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
                  placeholder="Please provide as much detail as possible — what happened, when it started, steps to reproduce, etc."
                  className="input-field resize-none"
                  required
                  disabled={status === 'loading'}
                  aria-describedby="desc-hint"
                />
                <div className="flex justify-between mt-1.5">
                  <p id="desc-hint" className="text-xs text-gray-400">More detail helps us resolve your issue faster</p>
                  <p className="text-xs text-gray-400">{description.length}/{MAX_DESCRIPTION}</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading' || !subject.trim() || !description.trim()}
                className="btn-primary w-full py-3"
              >
                {status === 'loading' ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Analyzing & Submitting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Submit Ticket
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: '🤖', title: 'AI Classification', desc: 'Auto-routed to the right team' },
            { icon: '⚡', title: 'Fast Response', desc: 'Draft response generated instantly' },
            { icon: '🔒', title: 'Secure', desc: 'Your data is protected' },
          ].map((feat) => (
            <div key={feat.title} className="py-4">
              <div className="text-2xl mb-2">{feat.icon}</div>
              <p className="text-sm font-medium text-gray-700">{feat.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{feat.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
