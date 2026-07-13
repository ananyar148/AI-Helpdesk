'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';

const TEAM_OPTIONS = ['Development', 'Billing', 'HR', 'Support'];
const ROLE_OPTIONS = ['TeamMember', 'Admin'];
const TEAM_COLORS  = {
  Development: 'bg-blue-100 text-blue-700',
  Billing:     'bg-emerald-100 text-emerald-700',
  HR:          'bg-pink-100 text-pink-700',
  Support:     'bg-orange-100 text-orange-700',
};

function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <p className="text-sm text-gray-700 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">Cancel</button>
          <button onClick={onConfirm}
            className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [togglingId,   setTogglingId]   = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [editingId,    setEditingId]    = useState(null);
  const [editForm,     setEditForm]     = useState({ name: '', team: '', role: '' });
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState({ name: '', email: '', role: 'TeamMember', team: 'Development' });

  useEffect(() => {
    fetch('/api/team-auth/me')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { if (!d.user || d.user.role !== 'Admin') router.push('/login'); })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res  = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setSuccess(`Invite sent to ${data.user.email}. They'll receive a link to set their password.`);
      setForm({ name: '', email: '', role: 'TeamMember', team: 'Development' });
      setShowForm(false);
      fetchUsers();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditForm({ name: u.name, team: u.team || 'Development', role: u.role });
    setError(''); setSuccess('');
  };

  const handleSaveEdit = async (userId) => {
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/users/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...data.user } : u));
      setSuccess(`Updated "${data.user.name}" successfully.`);
      setEditingId(null);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleToggleActive = (u) => {
    const next  = !u.isActive;
    const label = next ? 'Activate' : 'Deactivate';
    setConfirmModal({
      message:      `${label} "${u.name}"?${!next ? ' They will not be able to log in while inactive.' : ''}`,
      confirmLabel: label,
      danger:       !next,
      onConfirm:    () => doToggle(u, next),
    });
  };

  const doToggle = async (u, next) => {
    setConfirmModal(null);
    setTogglingId(u.id); setError('');
    try {
      const res  = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setUsers((prev) => prev.map((m) => m.id === u.id ? { ...m, isActive: next } : m));
      setSuccess(`"${u.name}" has been ${next ? 'activated' : 'deactivated'}.`);
    } catch (err) { setError(err.message); }
    finally { setTogglingId(null); }
  };

  const teamCounts = TEAM_OPTIONS.reduce((acc, t) => {
    acc[t] = users.filter((u) => u.team === t && u.isActive).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/admin" className="hover:text-blue-600">Admin Dashboard</Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">User Management</span>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <button onClick={() => { setShowForm(!showForm); setError(''); }} className="btn-primary">
            {showForm ? 'Cancel' : '+ Add User'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Click <strong>+ Add User</strong> to send an invite email — the user sets their own password.
          Click <strong>Edit</strong> to update details, or toggle <strong>Active / Inactive</strong> to control access.
        </p>

        {error   && <div className="alert-error mb-4 text-sm">{error}</div>}
        {success && <div className="alert-success mb-4 text-sm">{success}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {TEAM_OPTIONS.map((team) => (
            <div key={team} className="card py-3 px-4">
              <p className="text-2xl font-bold text-gray-900">{teamCounts[team]}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${TEAM_COLORS[team]}`}>
                {team}
              </span>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="card mb-8 border-blue-200 bg-blue-50/30">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Invite New User</h2>
            <p className="text-xs text-gray-500 mb-4">
              An invite email will be sent for them to set their own password and activate their account.
            </p>
            <form onSubmit={handleCreate} noValidate>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="input-label">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-field" placeholder="e.g. Ram Kumar" required disabled={submitting} />
                </div>
                <div>
                  <label className="input-label">Email Address <span className="text-red-500">*</span></label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field" placeholder="ram@yourcompany.com" required disabled={submitting} />
                  <p className="text-xs text-gray-400 mt-1">Invite link will be sent here</p>
                </div>
                <div>
                  <label className="input-label">Role <span className="text-red-500">*</span></label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="input-field" disabled={submitting}>
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {form.role === 'TeamMember' && (
                  <div>
                    <label className="input-label">Team <span className="text-red-500">*</span></label>
                    <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}
                      className="input-field" disabled={submitting}>
                      {TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Controls which tickets they can see</p>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-xs text-blue-700">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Secure invite link valid for 48 hours. Account activates when they set their password.
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting || !form.name || !form.email} className="btn-primary">
                  {submitting ? <><LoadingSpinner size="sm" /> Sending invite…</> : 'Send Invite'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            All Users <span className="ml-2 text-sm font-normal text-gray-400">({users.length})</span>
          </h2>

          {loading ? (
            <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    {['Name', 'Email', 'Role', 'Team', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="pb-3 pr-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className={`transition-colors ${u.isActive ? 'hover:bg-gray-50' : 'bg-gray-50/60 opacity-60'}`}>
                      {editingId === u.id ? (
                        <>
                          <td className="py-2 pr-4">
                            <input type="text" value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="input-field text-sm py-1.5" placeholder="Full name" />
                          </td>
                          <td className="py-2 pr-4 text-gray-400 text-xs">{u.email}</td>
                          <td className="py-2 pr-4">
                            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                              className="input-field text-sm py-1.5">
                              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-4">
                            {editForm.role === 'TeamMember' ? (
                              <select value={editForm.team} onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                                className="input-field text-sm py-1.5">
                                {TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="py-2 pr-4" />
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleSaveEdit(u.id)} disabled={saving}
                                className="btn-primary text-xs px-3 py-1.5">
                                {saving ? <LoadingSpinner size="sm" /> : 'Save'}
                              </button>
                              <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 pr-6">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                                ${u.isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-400'}`}>
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <span className={`font-medium ${u.isActive ? 'text-gray-900' : 'text-gray-400'}`}>{u.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-6 text-gray-500">{u.email}</td>
                          <td className="py-3 pr-6">
                            <span className={`badge ${u.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 pr-6">
                            {u.team
                              ? <span className={`badge ${TEAM_COLORS[u.team] || 'bg-gray-100 text-gray-600'}`}>{u.team}</span>
                              : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="py-3 pr-6">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full
                              ${u.isActive
                                ? 'bg-green-100 text-green-700'
                                : u.inviteToken
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                u.isActive ? 'bg-green-500' : u.inviteToken ? 'bg-yellow-400' : 'bg-red-400'
                              }`} />
                              {u.isActive ? 'Active' : u.inviteToken ? 'Invite Pending' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(u)}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline">Edit</button>
                              <button
                                onClick={() => handleToggleActive(u)}
                                disabled={togglingId === u.id || !!u.inviteToken}
                                title={u.inviteToken ? 'User must accept invite first' : ''}
                                className={`text-xs hover:underline disabled:opacity-40 disabled:cursor-not-allowed
                                  ${u.inviteToken
                                    ? 'text-gray-400'
                                    : u.isActive ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}>
                                {togglingId === u.id
                                  ? <LoadingSpinner size="sm" />
                                  : u.inviteToken ? 'Pending…'
                                  : u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <p className="font-semibold text-blue-900 mb-1">How it works</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            When you add a user, they receive an invite email with a secure link valid for <strong>48 hours</strong>.
            They click the link, set their own password, and are immediately logged in.
            <strong> Inactive users cannot log in</strong> — their account and history are preserved.
            Users showing <strong>Invite Pending</strong> have been invited but haven't accepted yet.
          </p>
        </div>

      </main>
    </div>
  );
}
