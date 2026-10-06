import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, MoreVertical, PencilLine, Power } from 'lucide-react';
import TemplateThumb from './TemplateThumb';
import { TEMPLATE_SAMPLE_CONTENT } from '../data/demoPosters';
import { timeAgo } from '../utils/timeAgo';

/** One template: a live miniature of the layout plus the management actions. */
export default function TemplateCard({ template, brandKit, busy = false, onEdit, onDuplicate, onToggleActive }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const active = template.isActive !== false;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnPointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnPointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnPointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const run = (action) => {
    setMenuOpen(false);
    action();
  };

  const itemClass = 'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-body hover:bg-section hover:text-heading disabled:opacity-50 disabled:hover:bg-transparent';

  return (
    <article className="card-surface flex flex-col overflow-hidden">
      <div className="bg-preview p-3 flex justify-center pointer-events-none select-none">
        <TemplateThumb brandKit={brandKit} template={template} content={TEMPLATE_SAMPLE_CONTENT} width={132} />
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-heading truncate" title={template.name}>
              {template.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {template.size?.width || 1080} × {template.size?.height || 1350}
              {template.updatedAt ? ` · updated ${timeAgo(template.updatedAt)}` : ''}
            </p>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={`Actions for ${template.name}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="rounded-btn border border-line p-1.5 text-heading transition-colors hover:border-primary"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-56 rounded-card border border-line bg-canvas shadow-soft py-1 z-30"
              >
                <button type="button" role="menuitem" className={itemClass} onClick={() => run(onEdit)} disabled={busy}>
                  <PencilLine className="h-4 w-4 shrink-0" /> Edit layout
                </button>
                <button type="button" role="menuitem" className={itemClass} onClick={() => run(onDuplicate)} disabled={busy}>
                  <Copy className="h-4 w-4 shrink-0" /> Make a copy
                </button>
                <div className="my-1 border-t border-line" />
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => run(onToggleActive)}
                  disabled={busy}
                >
                  <Power className="h-4 w-4 shrink-0" /> {active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span className="rounded-chip bg-section border border-line px-2 py-0.5 text-[11px] font-medium text-body">
            {template.category || 'Event'}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-[11px] font-semibold ${
              active ? 'bg-success/10 text-success' : 'bg-section text-muted border border-line'
            }`}
          >
            {active && <CheckCircle2 className="h-3 w-3" />}
            {active ? 'Active' : 'Inactive'}
          </span>
          {template.isDefault && (
            <span className="rounded-chip bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Default</span>
          )}
          <span className="ml-auto text-[11px] text-muted">Version {template.version || 1}</span>
        </div>

        {busy && <p className="text-[11px] text-muted">Working…</p>}
      </div>
    </article>
  );
}
