import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, Search, X } from 'lucide-react';

const idOf = (client) => client.id || client._id;

/** Slim context bar under the top bar; h-11 is the offset the sidebar sticky position assumes. */
export function OrgBar({ selected, onChange }) {
  return (
    <div className="h-11 border-b border-line bg-section">
      <div className="mx-auto flex h-full w-full max-w-page items-center gap-3 px-4 sm:px-6">
        {selected ? (
          <>
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-wider text-muted sm:inline">
              Working on
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-heading">
              {selected.name}
            </span>
            <button type="button" onClick={onChange} className="shrink-0 rounded-btn px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/10">
              Change
            </button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate text-sm text-body">
              Select an organization to open its brand kit, templates and posters
            </p>
            <button type="button" onClick={onChange} className="btn-primary shrink-0 !px-3 !py-1.5 text-sm">
              Select organization
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function OrgPicker({ open, clients, currentId, loading, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) => String(client.name || '').toLowerCase().includes(needle));
  }, [clients, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-heading/40 p-4 backdrop-blur-sm sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Choose an organization"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-line bg-canvas shadow-soft">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search organizations"
            aria-label="Search organizations"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-heading placeholder:text-muted focus:outline-none focus:ring-0"
          />
          <button type="button" onClick={onClose} className="text-muted hover:text-heading" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && clients.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Loading organizations…</p>
          ) : matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {query ? 'No organization matches that name.' : 'No organizations yet. Add one under Organizations.'}
            </p>
          ) : (
            matches.map((client) => {
              const id = idOf(client);
              const isActive = client.isActive !== false;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!isActive}
                  onClick={() => {
                    onPick(id);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-left text-sm transition-colors ${
                    id === currentId ? 'bg-primary/10 text-primary font-semibold' : 'text-body hover:bg-section hover:text-heading'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="min-w-0 flex-1 truncate">{client.name}</span>
                  {!isActive && <span className="shrink-0 text-xs text-muted">inactive</span>}
                  {id === currentId && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
