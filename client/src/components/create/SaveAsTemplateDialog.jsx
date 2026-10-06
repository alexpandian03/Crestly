import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Layout, Loader2 } from 'lucide-react';

const NAME_LIMIT = 120;

/** Suggested name: the design's own name, with a number when that one is taken. */
function suggestName(taken = []) {
  const base = 'Assistant design';
  if (!taken.some((n) => n.toLowerCase() === base.toLowerCase())) return base;
  let index = 2;
  while (taken.some((n) => n.toLowerCase() === `${base} ${index}`.toLowerCase())) index += 1;
  return `${base} ${index}`;
}

/**
 * Keeps an assistant-made design as a layout the whole organization can pick. The name is
 * the only thing asked for; the pieces of the design come from the poster as it was made.
 */
export default function SaveAsTemplateDialog({ existingNames = [], busy = false, error = '', onCancel, onSave }) {
  const [name, setName] = useState(() => suggestName(existingNames));
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [busy, onCancel]);

  const trimmed = name.trim();
  const problem = useMemo(() => {
    if (!trimmed) return 'Please give this layout a name.';
    if (trimmed.length < 2) return 'The name needs at least 2 characters.';
    return '';
  }, [trimmed]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-heading/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-as-template-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className="card-surface w-full max-w-md space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-chip bg-primary/10 p-2 text-primary">
            <Layout className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="save-as-template-title" className="text-base font-semibold text-heading">
              Save this design as a layout
            </h2>
            <p className="mt-1 text-sm text-body leading-snug">
              Anyone in your organization will be able to choose it on the Create page. You can change
              it later under Templates.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="new-template-name" className="block text-sm font-semibold text-heading mb-1.5">
            Name of this layout
          </label>
          <input
            id="new-template-name"
            ref={inputRef}
            type="text"
            value={name}
            maxLength={NAME_LIMIT}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !problem && !busy) onSave(trimmed);
            }}
            className="input-field"
            placeholder="For example: Health camp"
          />
          <p className="mt-1 text-[11px] text-muted">{trimmed.length}/{NAME_LIMIT}</p>
        </div>

        {(error || problem) && (
          <p className="text-sm text-danger" role="alert">
            {error || problem}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-ghost border border-line px-4 py-2 text-sm disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(trimmed)}
            disabled={busy || Boolean(problem)}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>{busy ? 'Saving…' : 'Save layout'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
