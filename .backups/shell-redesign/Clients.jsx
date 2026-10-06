import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Building2, Plus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const inp = 'w-full bg-section border border-line rounded-btn px-3.5 py-2.5 text-sm text-heading focus:outline-none focus:border-primary/60 transition-colors';

const planBadge = (p) => {
  if (p === 'enterprise') return 'bg-purple-500/10 text-purple-700 border-purple-300';
  if (p === 'pro')        return 'bg-primary/10 text-primary border-primary/30';
  if (p === 'starter')    return 'bg-success/10 text-success border-success/20';
  return 'bg-line text-muted border-line';
};

export default function Clients() {
  const { activeClientId, selectActiveClient } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName]   = useState('');
  const [plan, setPlan]   = useState('starter');
  const [feedback, setFeedback] = useState({ type: null, message: '' });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get('/clients');
      if (res.data?.success) setClients(res.data?.data?.clients || []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.error?.message || err.message || 'Failed to load clients' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setCreating(true);
      setFeedback({ type: null, message: '' });
      const res = await api.post('/clients', { name: name.trim(), plan });
      if (res.data?.success) {
        const createdClient = res.data?.data?.client;
        setFeedback({ type: 'success', message: `"${createdClient?.name || name.trim()}" registered successfully.` });
        setName(''); setPlan('starter'); setShowModal(false);
        fetchClients();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.error?.message || err.message || 'Failed to create client' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container-page section-pad space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-2xl flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Organisations
          </h1>
          <p className="text-muted text-sm mt-1">Manage registered client tenants and their service tiers.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold px-4 py-2.5 rounded-btn text-sm transition-colors shadow-soft"
        >
          <Plus className="w-4 h-4" /> Add client
        </button>
      </div>

      {/* Feedback */}
      {feedback.message && (
        <div className={`p-4 rounded-card text-sm flex items-center gap-3 border ${
          feedback.type === 'success'
            ? 'bg-success/5 border-success/20 text-success'
            : 'bg-danger/5 border-danger/20 text-danger'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-canvas border border-line rounded-card shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted">Loading…</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-muted mx-auto" />
            <p className="text-sm text-muted">No organisations yet.</p>
            <button onClick={() => setShowModal(true)} className="text-sm text-primary hover:underline">Add the first one</button>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-section border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-3.5 px-5">Name</th>
                <th className="py-3.5 px-5 hidden md:table-cell">Tenant ID</th>
                <th className="py-3.5 px-5">Plan</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 hidden sm:table-cell">Created</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clients.map(client => {
                const id = client.id || client._id;
                const isActive = client.isActive !== false;
                return (
                <tr key={id} className="hover:bg-section/60 transition-colors">
                  <td className="py-4 px-5 font-medium text-heading">{client.name}</td>
                  <td className="py-4 px-5 font-mono text-xs text-muted hidden md:table-cell">{id}</td>
                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-chip text-xs font-semibold uppercase tracking-wider border ${planBadge(client.plan)}`}>
                      {client.plan}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${isActive ? 'text-success' : 'text-danger'}`}>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-danger'}`} /> {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-muted text-xs hidden sm:table-cell">
                    {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <button
                      type="button"
                      disabled={!isActive || activeClientId === id}
                      onClick={() => selectActiveClient(id)}
                      className="px-3 py-1.5 rounded-btn border border-line text-xs font-medium hover:border-primary disabled:opacity-50"
                    >
                      {activeClientId === id ? 'Selected' : 'Work as client'}
                    </button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-heading/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-canvas border border-line rounded-card shadow-soft p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 className="text-base font-semibold text-heading flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> Register new client
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-heading text-lg leading-none">×</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Organisation name</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nike Global" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Plan</label>
                <select value={plan} onChange={e => setPlan(e.target.value)} className={inp}>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-btn border border-line text-muted hover:text-heading text-sm transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-btn text-sm transition-colors shadow-soft disabled:opacity-60">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
