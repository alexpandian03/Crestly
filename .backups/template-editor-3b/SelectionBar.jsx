import React, { useEffect, useRef, useState } from 'react';
import { Copy, Lock, LockOpen, Maximize2, Trash2 } from 'lucide-react';
import { ELEMENT_LIMITS } from '../../../../shared/templateElements.js';

/* ------------------------------------------------------------------ *
 * The small bar that floats next to the item you picked.
 *
 * It holds the three things you do most often - keep it in place, make a copy,
 * take it away - and a Position sheet for the exact numbers. The bar itself is
 * pushed around by the canvas during a drag, so nothing here re-renders while
 * your finger is down.
 * ------------------------------------------------------------------ */

const MIN_W = ELEMENT_LIMITS.minWidth;
const MIN_H = ELEMENT_LIMITS.minHeight;
const MAX = ELEMENT_LIMITS.fontSize.max * 40;

function NumberBox({ label, value, min, max, onChange }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (n) => Math.min(max, Math.max(min, Math.round(n)));

  const commit = (raw) => {
    const n = Number(raw);
    const next = Number.isFinite(n) && raw.trim() !== '' ? clamp(n) : clamp(value);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        min={min}
        max={max}
        onChange={(event) => {
          const n = Number(event.target.value);
          setDraft(event.target.value);
          if (Number.isFinite(n) && event.target.value.trim() !== '') onChange(clamp(n));
        }}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(event.target.value);
          }
        }}
        className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}

function IconButton({ label, pressed, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      {children}
    </button>
  );
}

export default function SelectionBar({
  item,
  scale,
  tagRef,
  canDelete,
  openUpward,
  onToggleLock,
  onDuplicate,
  onDelete,
  onRect,
  onReorder,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);

  /* The bar is drawn with pointer events back on, at the size the zoom allows. */
  const font = `${Math.max(10, 12 / Math.max(scale, 0.5))}px`;

  const set = (patch) =>
    onRect?.({
      x: item.x,
      y: item.y,
      w: Math.max(MIN_W, item.w),
      h: Math.max(MIN_H, item.h),
      ...patch,
    });

  return (
    <div
      ref={rootRef}
      className="flex items-center rounded-lg border border-slate-200 bg-white shadow-md"
      style={{ pointerEvents: 'auto', fontSize: font, width: 'max-content' }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <span ref={tagRef} className="px-1.5 text-[11px] font-semibold tabular-nums text-slate-500">
        {item.w} × {item.h}
      </span>
      <span aria-hidden="true" className="h-4 w-px bg-slate-200" />
      <IconButton
        label={item.locked ? 'Allow moving' : 'Keep in place'}
        pressed={Boolean(item.locked)}
        onClick={onToggleLock}
      >
        {item.locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      </IconButton>
      <IconButton label="Make a copy" onClick={onDuplicate}>
        <Copy className="h-3.5 w-3.5" />
      </IconButton>
      <button
        type="button"
        title={canDelete ? 'Remove' : 'The headline always stays on the poster'}
        aria-label="Remove"
        disabled={!canDelete}
        onClick={onDelete}
        className="rounded p-1.5 text-[rgb(220,38,38)] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-slate-200" />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <Maximize2 className="h-3.5 w-3.5" /> Position
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Position and size"
          className="absolute left-0 w-[228px] rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg"
          style={openUpward ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-2">
            <NumberBox label="From left" value={item.x} min={0} max={MAX} onChange={(x) => set({ x })} />
            <NumberBox label="From top" value={item.y} min={0} max={MAX} onChange={(y) => set({ y })} />
            <NumberBox label="Width" value={item.w} min={MIN_W} max={MAX} onChange={(w) => set({ w })} />
            <NumberBox label="Height" value={item.h} min={MIN_H} max={MAX} onChange={(h) => set({ h })} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Numbers are poster pixels. Anything outside the printable area is pulled back in.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onReorder?.('front')}
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Bring forward
            </button>
            <button
              type="button"
              onClick={() => onReorder?.('back')}
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Send backward
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
