'use client';

/**
 * Client Portal Dashboard — /portal/dashboard
 * Google-authenticated clients see all tickets tied to their account.
 * Fetches by clientUserId (Google session) and also by email for legacy tickets.
 */

import { useState, useEffect, useCallback, useRef } from 'react';import { useSession, signOut } from 'next-auth/react';
import { useRouter }           from 'next/navigation';
import Link                    from 'next/link';
import LoadingSpinner          from '../../components/LoadingSpinner';

const MAX_SUBJECT     = 150;
const MAX_DESCRIPTION = 2000;
const MAX_FILE_MB     = 5;
const MAX_FILES       = 25;
const ACCEPTED_TYPES  = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const STATUS_COLORS = {
  'Open':        'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'Resolved':    'bg-green-100 text-green-700',
  'Signed Off':  'bg-purple-100 text-purple-700',
};

const PRIORITY_COLORS = {
  'Low':      'bg-gray-100 text-gray-600',
  'Medium':   'bg-blue-50 text-blue-600',
  'High':     'bg-orange-100 text-orange-700',
  'Critical': 'bg-red-100 text-red-700',
};

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Ticket submission form ───────────────────────────────────────────────────
function TicketForm({ clientEmail, onSuccess, parentTicket = null, onCancel }) {
  const [subject,     setSubject]     = useState(parentTicket ? `Re: ${parentTicket.subject}` : '');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [phase,       setPhase]       = useState('idle');
  const [error,       setError]       = useState('');
  const [dupInfo,     setDupInfo]     = useState(null);
  const [preClass,    setPreClass]    = useState(null);
  const fileRef = useRef(null);
  const isLoading = phase === 'checking' || phase === 'creating';

  const handleFiles = async (files) => {
    setError('');
    const incoming = Array.from(files);
    if (attachments.length + incoming.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} images allowed.`); return;
    }
    const processed = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`"${file.name}" must be JPEG, PNG, GIF or WebP.`); return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`"${file.name}" exceeds ${MAX_FILE_MB} MB.`); return;
      }
      const dataUrl = await fileToDataUrl(file);
      processed.push({ fileName: file.name, mimeType: file.type, dataUrl, sizeBytes: file.size });
    }
    setAttachments((p) => [...p, ...processed]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (parentTicket) { await createTicket({}); return; }
    setPhase('checking');
    try {
      const res  = await fetch('/api/portal/tickets/check-duplicate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');
      if (data.isDuplicate && data.existingTicket) {
        setDupInfo({ existingTicket: data.existingTicket, score: data.score });
        setPreClass(data.classification);
        setPhase('duplicate');
        return;
      }
      await createTicket({ preClassification: data.classification });
    } catch (err) { setError(err.message); setPhase('idle'); }
  };

  const createTicket = async ({
    forceCreate = false, duplicateOfId = null,
    similarityScore = null, preClassification = null,
  } = {}) => {
    setPhase('creating');
    setError('');
    try {
      const res  = await fetch('/api/portal/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(), description: description.trim(),
          clientEmail, parentTicketId: parentTicket?.id || null,
          forceCreate, duplicateOfId, similarityScore, preClassification,
          attachments: attachments.map(({ fileName, mimeType, dataUrl, sizeBytes }) =>
            ({ fileName, mimeType, dataUrl, sizeBytes })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      onSuccess(data.ticket, data.emailStatus);
    } catch (err) { setError(err.message); setPhase('idle'); }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
          </svg>
          {error}
        </div>
      )}

      {phase === 'duplicate' && dupInfo && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm">
          <p className="font-semibold text-orange-900 mb-1">
            ⚠ Similar ticket already exists ({dupInfo.score}% match)
          </p>
          <p className="text-orange-700 font-medium mb-1">{dupInfo.existingTicket.subject}</p>
          <p className="text-orange-600 text-xs mb-3">Status: {dupInfo.existingTicket.status}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPhase('idle')} className="btn-secondary text-xs px-3 py-1.5">Go Back</button>
            <button type="button" disabled={isLoading}
              onClick={() => createTicket({ forceCreate: true, duplicateOfId: dupInfo.existingTicket.id, similarityScore: dupInfo.score, preClassification: preClass })}
              className="btn-primary text-xs px-3 py-1.5">
              {isLoading ? <LoadingSpinner size="sm" /> : 'Submit Anyway'}
            </button>
          </div>
        </div>
      )}

      {phase !== 'duplicate' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              maxLength={MAX_SUBJECT} placeholder="Brief summary of your issue"
              className="input-field" required disabled={isLoading} />
            <p className="text-xs text-gray-400 mt-1 text-right">{subject.length}/{MAX_SUBJECT}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION} rows={5}
              placeholder="Describe your issue in detail — include any error messages, steps to reproduce, etc."
              className="input-field resize-none" required disabled={isLoading} />
            <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/{MAX_DESCRIPTION}</p>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Screenshots / Images
            </label>
            {attachments.length < MAX_FILES && (
              <div onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <svg className="w-7 h-7 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p className="text-sm text-gray-500">Click or drag images here</p>
                <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG, GIF, WebP</p>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => handleFiles(e.target.files)} />
              </div>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative group">
                    <img src={att.dataUrl} alt={att.fileName} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                    <button type="button" onClick={() => setAttachments((p) => p.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    <p className="text-xs text-gray-400 mt-1 max-w-[80px] truncate">{att.fileName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isLoading || !subject.trim() || !description.trim()} className="btn-primary flex-1">
              {phase === 'checking' ? <><LoadingSpinner size="sm" /> Checking…</> :
               phase === 'creating' ? <><LoadingSpinner size="sm" /> Submitting…</> :
               parentTicket ? '↩ Submit Follow-up' : 'Submit Ticket'}
            </button>
            {onCancel && <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>}
          </div>
        </>
      )}
    </form>
  );
}

// ─── Ticket card ──────────────────────────────────────────────────────────────
function TicketCard({ ticket, clientEmail }) {
  const [expanded,     setExpanded]   = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'follow-up' | 'provide-details' | null
  const [messageText,  setMessageText] = useState('');
  const [attachments,  setAttachments] = useState([]);
  const [submitting,   setSubmitting]  = useState(false);
  const [msg,          setMsg]         = useState('');
  const [lightbox,     setLightbox]    = useState(null);
  const fileRef = useRef(null);

  const handleFiles = async (files) => {
    const incoming = Array.from(files);
    const processed = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue;
      if (file.size > MAX_FILE_MB * 1024 * 1024) continue;
      processed.push({ fileName: file.name, mimeType: file.type, dataUrl: await fileToDataUrl(file), sizeBytes: file.size });
    }
    setAttachments(p => [...p, ...processed].slice(0, MAX_FILES));
  };

  const handleAction = async (endpoint, successText) => {
    if (!messageText.trim()) return;
    setSubmitting(true);
    setMsg('');
    try {
      const res  = await fetch(`/api/portal/tickets/${ticket.id}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          message:     messageText.trim(),
          details:     messageText.trim(),
          attachments: attachments.map(({ fileName, mimeType, dataUrl, sizeBytes }) => ({ fileName, mimeType, dataUrl, sizeBytes })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setMsg(`✓ ${successText}`);
      setMessageText('');
      setAttachments([]);
      setTimeout(() => { setMsg(''); setActiveAction(null); }, 2500);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const closeAction = () => { setActiveAction(null); setMessageText(''); setAttachments([]); setMsg(''); };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-600'}`}>
                {ticket.status}
              </span>
              {ticket.priority && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-600'}`}>
                  {ticket.priority}
                </span>
              )}
              {ticket.category && <span className="text-xs text-gray-400">{ticket.category}</span>}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{ticket.subject}</h3>
            <p className="text-xs text-gray-400 mt-1">
              <span className="font-mono font-semibold text-gray-500">#{String(ticket.ticketNumber ?? '').padStart(3, '0')}</span>
              {' · '}Submitted {formatDate(ticket.createdAt)}
            </p>
          </div>
          <button onClick={() => setExpanded((p) => !p)}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {ticket.draftResponse && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1.5">✨ AI Suggested Response</p>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{ticket.draftResponse}</p>
            </div>
          )}

          {/* Conversation thread — team messages + client follow-ups */}
          {ticket.activities?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Conversation</p>
              {ticket.activities.map(act => {
                const isClientMessage = act.action === 'details_provided' || act.action === 'follow_up_added';
                return (
                  <div key={act.id} className={`rounded-lg p-3.5 ${isClientMessage
                    ? 'bg-blue-50 border border-blue-200 ml-4'
                    : 'bg-amber-50 border border-amber-200 mr-4'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                          isClientMessage ? 'bg-blue-200 text-blue-800' : 'bg-amber-200 text-amber-800'
                        }`}>
                          {isClientMessage ? 'Y' : (act.userName ? act.userName.charAt(0).toUpperCase() : '?')}
                        </span>
                        <span className={`text-xs font-semibold ${isClientMessage ? 'text-blue-800' : 'text-amber-800'}`}>
                          {isClientMessage
                            ? 'You'
                            : `${act.userName || 'Support'}${act.userTeam ? ` · ${act.userTeam}` : ''}`
                          }
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          act.action === 'details_requested' ? 'bg-amber-100 text-amber-700' :
                          act.action === 'follow_up_added'   ? 'bg-blue-100 text-blue-700' :
                                                               'bg-green-100 text-green-700'
                        }`}>
                          {act.action === 'details_requested' ? 'Requesting details' :
                           act.action === 'follow_up_added'   ? 'Follow-up' :
                                                                'Additional details'}
                        </span>
                      </div>
                      <time className={`text-xs flex-shrink-0 ${isClientMessage ? 'text-blue-500' : 'text-amber-600'}`}>
                        {new Date(act.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </time>
                    </div>
                    <p className={`text-sm leading-snug whitespace-pre-wrap ${isClientMessage ? 'text-blue-900' : 'text-amber-900'}`}>
                      {act.newValue}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {ticket.attachments?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Attachments</p>
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((att) => (
                  att.dataUrl && att.mimeType?.startsWith('image/') ? (
                    <button key={att.id} type="button" onClick={() => setLightbox(att)}
                      className="relative group focus:outline-none">
                      <img src={att.dataUrl} alt={att.fileName}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:border-blue-400 transition-colors cursor-zoom-in shadow-sm" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                        <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                        </svg>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 max-w-[80px] truncate text-left">{att.fileName}</p>
                    </button>
                  ) : (
                    <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                      </svg>
                      {att.fileName}
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Lightbox */}
          {lightbox && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
              onClick={() => setLightbox(null)}>
              <div className="relative max-w-3xl w-full flex flex-col items-center"
                onClick={e => e.stopPropagation()}>
                <div className="w-full flex items-center justify-between mb-3 px-1">
                  <p className="text-sm text-white/80 truncate max-w-[80%]">{lightbox.fileName}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const a = document.createElement('a'); a.href = lightbox.dataUrl; a.download = lightbox.fileName; a.click(); }}
                      className="text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                      </svg>
                      Download
                    </button>
                    <button onClick={() => setLightbox(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/30 text-white transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <img src={lightbox.dataUrl} alt={lightbox.fileName}
                  className="max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain" />
                <p className="text-white/30 text-xs mt-3">Click outside to close</p>
              </div>
            </div>
          )}

          {ticket.status !== 'Resolved' && (
            <div className="border-t border-gray-100 pt-4">
              {activeAction ? (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    {activeAction === 'follow-up' ? 'Add a Follow-up' : 'Provide Additional Details'}
                  </p>
                  {msg && (
                    <p className={`text-sm mb-2 ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>
                  )}
                  <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)}
                    rows={4}
                    placeholder={activeAction === 'follow-up'
                      ? 'Add more context or an update to this ticket…'
                      : 'Share the additional details our team requested…'}
                    className="input-field resize-none text-sm mb-3" disabled={submitting} />

                  {/* Image attachments */}
                  <div className="mb-3">
                    <div
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                      className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <p className="text-xs text-gray-400">Click or drag images here (optional)</p>
                      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={e => handleFiles(e.target.files)} />
                    </div>
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {attachments.map((att, idx) => (
                          <div key={idx} className="relative group">
                            <img src={att.dataUrl} alt={att.fileName} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                            <button type="button"
                              onClick={() => setAttachments(p => p.filter((_, i) => i !== idx))}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(activeAction, activeAction === 'follow-up' ? 'Follow-up added.' : 'Details submitted.')}
                      disabled={submitting || !messageText.trim()}
                      className="btn-primary text-sm">
                      {submitting ? <><LoadingSpinner size="sm" /> Submitting…</> : 'Submit'}
                    </button>
                    <button onClick={closeAction} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setActiveAction('follow-up')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                    </svg>
                    Add follow-up
                  </button>
                  <button onClick={() => setActiveAction('provide-details')}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    Provide details
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function PortalDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // client_token user (email/password login)
  const [clientUser,   setClientUser]   = useState(null);
  const [authChecked,  setAuthChecked]  = useState(false);

  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [emailToast,   setEmailToast]   = useState(null);

  // Check client_token cookie (email/password users)
  useEffect(() => {
    fetch('/api/portal/client-auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.client) setClientUser(data.client); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // Redirect if neither auth method is active
  useEffect(() => {
    if (!authChecked) return;
    if (status === 'loading') return;
    if (!clientUser && status === 'unauthenticated') {
      router.replace('/portal/login');
    }
  }, [authChecked, status, clientUser, router]);

  // Prefer email/password (client_token) over Google — if both exist, client_token wins
  // This ensures switching accounts via login page works correctly
  const isGoogleUser  = status === 'authenticated' && !clientUser;
  const activeUser    = clientUser
    ? { name: clientUser.name, email: clientUser.email, image: null }
    : isGoogleUser
      ? { name: session.user.name, email: session.user.email, image: session.user.image }
      : null;

  const isReady = authChecked && (isGoogleUser || !!clientUser);

  const fetchTickets = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/portal/tickets/my');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tickets');
      setTickets(data.tickets || []);
    } catch (err) { 
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleNewTicket = (ticket, emailStatus) => {
    setTickets((prev) => [ticket, ...prev]);
    setShowForm(false);
    if (emailStatus) {
      setEmailToast({ sent: emailStatus.clientEmailSent });
      setTimeout(() => setEmailToast(null), 5000);
    }
  };

  const handleSignOut = async () => {
    if (clientUser) {
      // Email/password session — clear client_token cookie
      await fetch('/api/portal/client-auth/logout', { method: 'POST' });
      router.push('/portal/login');
    } else {
      // Google session
      signOut({ callbackUrl: '/portal/login' });
    }
  };

  const filtered = statusFilter === 'All'
    ? tickets
    : tickets.filter((t) => t.status === statusFilter);

  const counts = {
    All:           tickets.length,
    Open:          tickets.filter((t) => t.status === 'Open').length,
    'In Progress': tickets.filter((t) => t.status === 'In Progress').length,
    Resolved:      tickets.filter((t) => t.status === 'Resolved').length,
  };

  // Show spinner while checking auth
  if (!authChecked || status === 'loading' || (!activeUser && authChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!activeUser) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">HelpDesk</span>
          </Link>

          <div className="flex items-center gap-3">
            {activeUser.image
              ? <img src={activeUser.image} alt={activeUser.name} className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
              : <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {activeUser.name?.charAt(0).toUpperCase()}
                </div>
            }
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900 leading-tight">{activeUser.name}</p>
              <p className="text-xs text-gray-400 leading-tight">{activeUser.email}</p>
            </div>
            <button onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 font-medium">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Email notification toast */}
        {emailToast !== null && (
          <div className={`fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm max-w-sm transition-all
            ${emailToast.sent
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <span className="text-lg leading-none mt-0.5">
              {emailToast.sent ? '✉️' : '⚠️'}
            </span>
            <div className="flex-1">
              <p className="font-semibold leading-snug">
                {emailToast.sent ? 'Confirmation email sent' : 'Email not sent'}
              </p>
              <p className="text-xs mt-0.5 opacity-80">
                {emailToast.sent
                  ? `A confirmation was sent to ${activeUser.email}`
                  : 'Your ticket was created, but the confirmation email could not be delivered. Check your spam folder or contact support.'}
              </p>
            </div>
            <button onClick={() => setEmailToast(null)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity ml-1 mt-0.5"
              aria-label="Dismiss">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
            <p className="text-sm text-gray-500 mt-0.5">All support requests tied to your account</p>
          </div>
          <button onClick={() => setShowForm((p) => !p)}
            className="btn-primary flex items-center gap-2">
            {showForm ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                New Ticket
              </>
            )}
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Submit a New Ticket</h2>
            <TicketForm
              clientEmail={activeUser.email}
              onSuccess={handleNewTicket}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Object.entries(counts).map(([label, count]) => (
            <button key={label} onClick={() => setStatusFilter(label)}
              className={`p-3 rounded-xl border text-left transition-colors ${
                statusFilter === label
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}>
              <p className={`text-2xl font-bold ${statusFilter === label ? 'text-blue-700' : 'text-gray-900'}`}>{count}</p>
              <p className={`text-xs mt-0.5 ${statusFilter === label ? 'text-blue-600' : 'text-gray-500'}`}>{label}</p>
            </button>
          ))}
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">{error}</p>
            <button onClick={fetchTickets} className="mt-3 text-sm text-red-600 hover:text-red-700 underline">Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {statusFilter === 'All' ? (
              <>
                <p className="text-gray-500 font-medium">No tickets yet</p>
                <p className="text-gray-400 text-sm mt-1">Click "New Ticket" above to get support.</p>
              </>
            ) : (
              <p className="text-gray-500 font-medium">No {statusFilter.toLowerCase()} tickets</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                clientEmail={activeUser.email}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
