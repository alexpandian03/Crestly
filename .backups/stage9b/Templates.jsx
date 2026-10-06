import React, { useEffect, useState } from 'react';
import { AlertCircle, LayoutGrid, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Templates() {
  const { activeClientId } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadTemplates() {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/templates');
        if (active) setTemplates(response.data?.data?.templates || []);
      } catch (err) {
        if (active) setError(err.response?.data?.error?.message || 'We could not load the templates.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTemplates();
    return () => {
      active = false;
    };
  }, [activeClientId]);

  return (
    <div className="container-page section-pad space-y-6">
      <div className="pb-6 border-b border-line">
        <h1 className="text-2xl flex items-center gap-2"><LayoutGrid className="w-6 h-6 text-primary" /> Templates</h1>
        <p className="text-sm text-muted mt-1">Available layouts for your organization.</p>
      </div>

      {error && <div className="p-4 rounded-card border border-danger/30 bg-danger/5 text-danger text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 text-primary animate-spin" /></div>
      ) : templates.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <LayoutGrid className="w-10 h-10 text-muted mx-auto" />
          <p className="mt-3 text-sm text-muted">No templates are available yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <article key={template.id || template._id} className="card-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base">{template.name}</h2>
                  <p className="text-sm text-muted mt-1">{template.category || 'General'}</p>
                </div>
                <span className="rounded-chip bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  {template.isActive === false ? 'Inactive' : 'Available'}
                </span>
              </div>
              {template.size && <p className="mt-4 text-xs text-muted">{template.size.width} × {template.size.height}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
