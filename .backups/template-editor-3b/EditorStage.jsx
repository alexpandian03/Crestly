import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import PosterCanvas from '../PosterCanvas';
import SelectionBar from './SelectionBar';
import ItemTextEditor from './ItemTextEditor';
import { ELEMENT_LIMITS } from '../../../../shared/templateElements.js';
import { isTypedText, itemLabel, isHeadlineItem } from '../../utils/templateEditorItems';

/* ------------------------------------------------------------------ *
 * The one place an item is placed by hand.
 *
 * The poster underneath is the real <PosterCanvas>, authored at full poster pixels and
 * shrunk with a single CSS transform, exactly like the preview and the export. The boxes
 * you grab are a sibling layer drawn in SCREEN pixels, so a handle is always 10 px on
 * screen whatever the zoom.
 *
 * While a gesture runs React is not involved at all: the box being moved and the words it
 * stands for are pushed about by a CSS transform inside requestAnimationFrame, and the new
 * numbers are written into the item list once, when the pointer is released.
 * ------------------------------------------------------------------ */

const HANDLE_KEYS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_SPOTS = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
};
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
const MIN = { w: ELEMENT_LIMITS.minWidth, h: ELEMENT_LIMITS.minHeight };
const ZOOMS = ['fit', 50, 75, 100, 150];

function whole(value) {
  return Math.round(Number(value) || 0);
}

/** The same box, moved so it stays whole and fully inside the area. */
export function moveRect(start, dx, dy, area) {
  const x = Math.min(Math.max(start.x + dx, area.x), area.x + area.w - start.w);
  const y = Math.min(Math.max(start.y + dy, area.y), area.y + area.h - start.h);
  return { x: whole(x), y: whole(y), w: start.w, h: start.h };
}

/**
 * One edge or corner moved by (dx, dy) poster pixels: never smaller than the minimum the
 * save rules allow, never outside the area, and with Shift on a corner the proportions hold.
 */
export function resizeRect(start, handle, dx, dy, { keepRatio = false, area } = {}) {
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;

  if (handle.includes('e')) w = start.w + dx;
  if (handle.includes('s')) h = start.h + dy;
  if (handle.includes('w')) w = start.w - dx;
  if (handle.includes('n')) h = start.h - dy;

  if (keepRatio && handle.length === 2 && start.w > 0 && start.h > 0) {
    const factor = Math.max(w / start.w, h / start.h);
    w = start.w * factor;
    h = start.h * factor;
  }

  w = Math.max(MIN.w, w);
  h = Math.max(MIN.h, h);
  if (handle.includes('w')) x = Math.max(area.x, right - w);
  if (handle.includes('n')) y = Math.max(area.y, bottom - h);

  if (handle.includes('w')) w = x + w - area.x;
  if (handle.includes('n')) h = y + h - area.y;
  w = Math.max(MIN.w, Math.min(w, area.x + area.w - x));
  h = Math.max(MIN.h, Math.min(h, area.y + area.h - y));
  x = Math.min(x, area.x + area.w - w);
  y = Math.min(y, area.y + area.h - h);

  return { x: whole(x), y: whole(y), w: whole(w), h: whole(h) };
}

function clampTo(rect, area) {
  const w = Math.min(rect.w, area.w);
  const h = Math.min(rect.h, area.h);
  return {
    x: whole(Math.min(Math.max(rect.x, area.x), area.x + area.w - w)),
    y: whole(Math.min(Math.max(rect.y, area.y), area.y + area.h - h)),
    w,
    h,
  };
}

const handleStyle = (key) => {
  const [fx, fy] = HANDLE_SPOTS[key];
  return {
    position: 'absolute',
    left: `${fx * 100}%`,
    top: `${fy * 100}%`,
    width: '10px',
    height: '10px',
    marginLeft: '-5px',
    marginTop: '-5px',
    background: '#ffffff',
    border: '1.5px solid #2563eb',
    borderRadius: '2px',
    boxSizing: 'border-box',
    cursor: CURSORS[key],
    touchAction: 'none',
  };
};

/**
 * One item's outline. It is memoized: a change to another item, or a style edit somewhere
 * else on the poster, never redraws this one.
 */
const ItemFrame = memo(function ItemFrame({ item, scale, selected, editing, guidesOn, registerFrame, onSelect, onStart, onEdit }) {
  const locked = Boolean(item.locked);
  const picture = item.kind === 'image' || item.field === 'photo';
  const border = !guidesOn
    ? '1px solid transparent'
    : selected
    ? '1.5px solid #2563eb'
    : locked
    ? '1px solid transparent'
    : `1px dashed ${picture ? '#475569' : '#2563eb'}`;

  return (
    <div
      ref={(node) => registerFrame(item.id, node)}
      role="button"
      tabIndex={0}
      aria-label={`${itemLabel(item)}, ${item.w} by ${item.h} pixels, at ${item.x}, ${item.y}${locked ? ', fixed in place' : ''}`}
      aria-pressed={selected}
      className="outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      style={{
        position: 'absolute',
        left: `${whole(item.x * scale)}px`,
        top: `${whole(item.y * scale)}px`,
        width: `${whole(item.w * scale)}px`,
        height: `${whole(item.h * scale)}px`,
        boxSizing: 'border-box',
        border,
        borderRadius: '2px',
        cursor: locked ? 'default' : 'move',
        touchAction: 'none',
        zIndex: selected ? 30 : 20,
      }}
      onFocus={() => onSelect(item.id)}
      onPointerDown={(event) => {
        if (editing) return;
        event.stopPropagation();
        onSelect(item.id);
        if (!locked) onStart(event, item, 'move');
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onSelect(item.id);
        if (isTypedText(item) && !locked) onEdit(item.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSelect(item.id);
          if (isTypedText(item) && !locked) onEdit(item.id);
        }
      }}
    >
      {guidesOn && selected && !locked && !editing
        ? HANDLE_KEYS.map((key) => (
            <div
              key={key}
              data-handle={key}
              aria-hidden="true"
              style={handleStyle(key)}
              onPointerDown={(event) => {
                event.stopPropagation();
                onStart(event, item, 'resize', key);
              }}
            />
          ))
        : null}
    </div>
  );
});

/** The brand header and footer: dimmed, locked, and a way to the settings that own them. */
function BandOverlay({ area, size, scale, band, open, onOpen }) {
  const box =
    band === 'header'
      ? { left: 0, top: 0, width: `${whole(size.width * scale)}px`, height: `${whole(area.y * scale)}px` }
      : {
          left: 0,
          top: `${whole((area.y + area.h) * scale)}px`,
          width: `${whole(size.width * scale)}px`,
          height: `${whole(Math.max(0, size.height - area.y - area.h) * scale)}px`,
        };
  if (band === 'header' && area.y <= 0) return null;
  if (band === 'footer' && size.height - area.y - area.h <= 0) return null;
  return (
    <div
      data-band={band}
      style={{
        position: 'absolute',
        ...box,
        background: 'rgba(15, 23, 42, 0.42)',
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onOpen(open ? null : band);
        }}
        className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        style={{ pointerEvents: 'auto', fontSize: `${Math.max(9, 11 / Math.max(scale, 0.35))}px` }}
      >
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        {band === 'header' ? 'Brand header' : 'Brand footer'}
      </button>
    </div>
  );
}

function BrandPopover({ band, onClose }) {
  return (
    <div
      role="dialog"
      aria-label="Brand area"
      className="absolute z-[45] w-[240px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
      style={{
        left: '50%',
        transform: 'translateX(-50%)',
        top: band === 'header' ? 8 : undefined,
        bottom: band === 'footer' ? 8 : undefined,
        pointerEvents: 'auto',
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-xs leading-relaxed text-slate-600">
          {band === 'header'
            ? 'The top of every poster is your organization name and logo. It is the same on all your templates, so it is not placed here.'
            : 'The bottom of every poster carries your contact details. It is the same on all your templates, so it is not placed here.'}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Link
        to="/brand-kit"
        className="mt-2 inline-flex rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
      >
        Edit in Brand Kit
      </Link>
    </div>
  );
}

export default function EditorStage({
  size,
  area,
  brandKit,
  template,
  content,
  items,
  selectedId,
  editingId,
  zoom = 'fit',
  guidesOn = true,
  onSelect,
  onStartEdit,
  onStopEdit,
  onCommitText,
  onCanvasClick,
  onCommitRect,
  onToggleLock,
  onDuplicate,
  onDelete,
  onReorder,
  onZoom,
  onToggleGuides,
}) {
  const boxRef = useRef(null);
  const posterRef = useRef(null);
  const frames = useRef(new Map());
  const barRef = useRef(null);
  const tagRef = useRef(null);
  const gesture = useRef(null);
  const rafRef = useRef(0);
  const pendingRef = useRef(null);
  const [fitScale, setFitScale] = useState(0.5);
  const [bandPopover, setBandPopover] = useState(null);

  /* Read-latest refs: the gesture handlers are created once and must still see today's
     values, otherwise a move would be clamped against an out-of-date area. */
  const actionsRef = useRef({});
  actionsRef.current = {
    onSelect,
    onCommitRect,
    onCommitText,
    onStartEdit,
    onToggleLock,
    onDuplicate,
    onDelete,
    onReorder,
  };
  const areaRef = useRef(area);
  areaRef.current = area;

  /** Fit the whole poster into the room there is, both ways, at 1:1 at most. */
  useLayoutEffect(() => {
    const measure = () => {
      const node = boxRef.current;
      if (!node) return;
      const next = Math.max(
        0.05,
        Math.min(1, (node.clientWidth - 32) / size.width, (node.clientHeight - 32) / size.height)
      );
      setFitScale((prev) => (Math.abs(prev - next) < 0.0005 ? prev : next));
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (observer && boxRef.current) observer.observe(boxRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [size.width, size.height]);

  useEffect(() => {
    if (!bandPopover) return undefined;
    const close = () => setBandPopover(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [bandPopover]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const percent = zoom === 'fit' ? Math.round(fitScale * 100) : Number(zoom);
  const scale = Math.max(0.05, Math.min(4, percent / 100));

  const selectedItem = useMemo(
    () => (Array.isArray(items) ? items.find((item) => item.id === selectedId) : null) || null,
    [items, selectedId]
  );

  /** Transform only, once per animation frame: no React render, no re-layout. */
  const paint = useCallback(() => {
    rafRef.current = 0;
    const state = gesture.current;
    const point = pendingRef.current;
    if (!state || !point) return;
    const dx = (point.x - state.startPoint.x) / state.scale;
    const dy = (point.y - state.startPoint.y) / state.scale;
    const rect =
      state.mode === 'move'
        ? moveRect(state.start, dx, dy, areaRef.current)
        : resizeRect(state.start, state.handle, dx, dy, { keepRatio: point.shift, area: areaRef.current });
    if (
      state.rect &&
      rect.x === state.rect.x &&
      rect.y === state.rect.y &&
      rect.w === state.rect.w &&
      rect.h === state.rect.h
    ) {
      return;
    }
    state.rect = rect;

    const tx = whole((rect.x - state.start.x) * state.scale);
    const ty = whole((rect.y - state.start.y) * state.scale);
    const sx = state.start.w > 0 ? rect.w / state.start.w : 1;
    const sy = state.start.h > 0 ? rect.h / state.start.h : 1;
    const frame = frames.current.get(state.id);
    if (frame) {
      frame.style.transform =
        state.mode === 'move'
          ? `translate3d(${tx}px, ${ty}px, 0)`
          : `translate3d(${tx}px, ${ty}px, 0) scale(${sx}, ${sy})`;
      if (state.mode === 'resize') {
        frame.querySelectorAll('[data-handle]').forEach((handle) => {
          handle.style.transform = `scale(${1 / sx}, ${1 / sy})`;
        });
      }
    }
    /* The words themselves only shift sideways or down: stretching them would lie about
       how many lines they need, and the real fit runs when the numbers are committed. */
    if (state.underlay) state.underlay.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    if (barRef.current) barRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    if (tagRef.current) tagRef.current.textContent = `${rect.w} × ${rect.h}`;
  }, []);

  const onPointerMove = useCallback(
    (event) => {
      if (!gesture.current) return;
      pendingRef.current = { x: event.clientX, y: event.clientY, shift: event.shiftKey };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(paint);
    },
    [paint]
  );

  const endGesture = useCallback(() => {
    const state = gesture.current;
    gesture.current = null;
    pendingRef.current = null;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endGesture);
    window.removeEventListener('pointercancel', endGesture);
    if (!state) return;
    const frame = frames.current.get(state.id);
    if (frame) {
      frame.style.transform = '';
      frame.querySelectorAll('[data-handle]').forEach((handle) => {
        handle.style.transform = '';
      });
    }
    if (state.underlay) state.underlay.style.transform = '';
    if (barRef.current) barRef.current.style.transform = '';
    const moved =
      state.rect &&
      (state.rect.x !== state.start.x ||
        state.rect.y !== state.start.y ||
        state.rect.w !== state.start.w ||
        state.rect.h !== state.start.h);
    if (moved) actionsRef.current.onCommitRect?.(state.id, state.rect);
  }, [onPointerMove]);

  const begin = useCallback(
    (event, item, mode, handle) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (item.locked || (mode !== 'move' && mode !== 'resize')) return;
      const start = clampTo({ x: item.x, y: item.y, w: item.w, h: item.h }, areaRef.current);
      gesture.current = {
        id: item.id,
        mode,
        handle,
        start,
        rect: start,
        scale,
        startPoint: { x: event.clientX, y: event.clientY },
        underlay: posterRef.current?.querySelector(`[data-element="${item.id}"]`) || null,
      };
      try {
        event.currentTarget?.setPointerCapture?.(event.pointerId);
      } catch {
        /* the pointer is already gone under a synthetic event */
      }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', endGesture);
      window.addEventListener('pointercancel', endGesture);
    },
    [scale, onPointerMove, endGesture]
  );

  const registerFrame = useCallback((id, node) => {
    if (node) frames.current.set(id, node);
    else frames.current.delete(id);
  }, []);

  const ordered = useMemo(() => (Array.isArray(items) ? items : []).slice().sort((a, b) => a.z - b.z), [items]);

  const barBox = barRectOf(selectedItem, area, scale);
  /* The position sheet opens above the bar when there is no room left below it. */
  const barOpensUp = Boolean(barBox) && barBox.top + 260 > whole(size.height * scale);

  return (
    <div
      ref={boxRef}
      className="relative min-h-0 flex-1 overflow-auto bg-[#e9edf2]"
      onPointerDown={() => {
        setBandPopover(null);
        onCanvasClick?.();
      }}
    >
      <div className="flex min-h-full w-full" style={{ padding: 16 }}>
        <div
          className="relative shrink-0 overflow-hidden bg-white shadow-md"
          style={{ width: `${whole(size.width * scale)}px`, height: `${whole(size.height * scale)}px`, margin: 'auto' }}
        >
          <div
            ref={posterRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${size.width}px`,
              height: `${size.height}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            <PosterCanvas brandKit={brandKit} template={template} content={content} />
          </div>

          <div className="absolute inset-0" style={{ zIndex: 10 }}>
            {guidesOn ? (
              <>
                <BandOverlay area={area} size={size} scale={scale} band="header" open={bandPopover === 'header'} onOpen={setBandPopover} />
                <BandOverlay area={area} size={size} scale={scale} band="footer" open={bandPopover === 'footer'} onOpen={setBandPopover} />
              </>
            ) : null}
            {bandPopover === 'header' ? <BrandPopover band="header" onClose={() => setBandPopover(null)} /> : null}
            {bandPopover === 'footer' ? <BrandPopover band="footer" onClose={() => setBandPopover(null)} /> : null}

            {ordered.map((item) => (
              <ItemFrame
                key={item.id}
                item={item}
                scale={scale}
                selected={item.id === selectedId}
                editing={item.id === editingId}
                guidesOn={guidesOn}
                registerFrame={registerFrame}
                onSelect={onSelect}
                onStart={begin}
                onEdit={onStartEdit}
              />
            ))}

            {barBox && selectedItem && !editingId ? (
              <div
                ref={barRef}
                style={{ position: 'absolute', left: `${barBox.left}px`, top: `${barBox.top}px`, zIndex: 40, pointerEvents: 'none' }}
              >
                <SelectionBar
                  item={selectedItem}
                  scale={scale}
                  tagRef={tagRef}
                  canDelete={!isHeadlineItem(selectedItem)}
                  openUpward={barOpensUp}
                  onToggleLock={() => actionsRef.current.onToggleLock?.(selectedItem.id)}
                  onDuplicate={() => actionsRef.current.onDuplicate?.(selectedItem.id)}
                  onDelete={() => actionsRef.current.onDelete?.(selectedItem.id)}
                  onReorder={(direction) => actionsRef.current.onReorder?.(selectedItem.id, direction)}
                  onRect={(rect) => actionsRef.current.onCommitRect?.(selectedItem.id, rect)}
                />
              </div>
            ) : null}

            {editingId && selectedItem ? (
              <ItemTextEditor
                item={selectedItem}
                scale={scale}
                onCommit={(text) => {
                  actionsRef.current.onCommitText?.(selectedItem.id, text);
                  onStopEdit?.();
                }}
                onCancel={onStopEdit}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-3 right-3 z-[50] flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
        role="group"
        aria-label="Zoom"
      >
        {ZOOMS.map((step) => {
          const active = zoom === step;
          return (
            <button
              key={step}
              type="button"
              aria-pressed={active}
              onClick={() => onZoom(step)}
              className={`min-w-[38px] rounded px-2 py-1 text-[11px] font-semibold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {step === 'fit' ? 'Fit' : `${step}%`}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onToggleGuides}
        aria-pressed={!guidesOn}
        className="absolute bottom-3 left-3 z-[50] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      >
        {guidesOn ? 'Hide guides' : 'Show guides'}
      </button>

      <p className="absolute bottom-3 left-1/2 z-[49] -translate-x-1/2 text-[11px] text-slate-500">
        {percent}% · {size.width} × {size.height}
      </p>
    </div>
  );
}

/** The bar sits just above the picked box, kept inside the poster's own width. */
function barRectOf(item, area, scale) {
  if (!item) return null;
  const box = clampTo({ x: item.x, y: item.y, w: item.w, h: item.h }, area);
  return { left: whole(box.x * scale), top: whole(Math.max(0, box.y - 34 / scale) * scale) };
}
