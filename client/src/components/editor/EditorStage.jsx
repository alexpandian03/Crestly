import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Lock, Sparkles, X } from 'lucide-react';
import PosterCanvas from '../PosterCanvas';
import SelectionBar from './SelectionBar';
import ItemTextEditor from './ItemTextEditor';
import { ELEMENT_LIMITS } from '../../../../shared/templateElements.js';
import { isHeadlineItem, isTypedText, isUserImage, itemLabel, modeOf } from '../../utils/templateEditorItems';
import { gridBackgroundImage, guideTargets, nearestSnap } from '../../utils/editorGuides';

/* ------------------------------------------------------------------ *
 * The one place an item is placed by hand.
 *
 * The poster underneath is the real <PosterCanvas>, authored at full poster pixels and
 * shrunk with a single CSS transform, exactly like the preview and the export. The boxes
 * you grab are a sibling layer drawn in SCREEN pixels, so a handle is always 10 px on
 * screen whatever the zoom.
 *
 * While a gesture runs React is not involved at all: the box being moved and the words it
 * stands for are pushed about by a CSS transform inside requestAnimationFrame, the snap
 * lines are drawn from the same frame, and the new numbers are written into the item list
 * once, when the pointer is released.
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
const ZOOM_FLOOR = 10;
const ZOOM_CEILING = 400;
const GUIDE_COLOR = '#f43f5e';

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

/** How an item that a person or the assistant fills in later is described to a screen reader. */
function modeAria(item) {
  if (item?.kind !== 'text' && item?.kind !== 'image') return '';
  const mode = modeOf(item);
  if (mode === 'ai') return 'the assistant writes these words';
  if (mode === 'user') return 'the person filling this in chooses the picture';
  return 'part of the design, nobody fills it in';
}

/**
 * The one cue an item carries on the canvas, kept in screen pixels so it is readable at any
 * zoom. It sits in the overlay, never in the poster, and says so for the export as well.
 */
function cueStyle(scale, tone) {
  const size = Math.max(11, Math.min(15, 12 / Math.max(scale, 0.15)));
  return {
    height: `${size}px`,
    fontSize: `${size}px`,
    background: tone.background,
    color: tone.color,
    border: `1px solid ${tone.border}`,
    borderRadius: `${Math.max(3, size / 2.5)}px`,
  };
}

/**
 * The badges that tell an admin who fills the box in later, and the empty tile a photo
 * blank shows until somebody picks one.
 */
function ItemCues({ item, scale, pictureBlank }) {
  if (pictureBlank) {
    return (
      <div
        data-export-ignore="true"
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-[3px] border-2 border-dashed border-slate-400 bg-slate-100/70 text-slate-500"
        style={{ pointerEvents: 'none' }}
      >
        <ImagePlus style={{ width: `${Math.max(14, Math.min(34, 20 / Math.max(scale, 0.2)))}px`, height: `${Math.max(14, Math.min(34, 20 / Math.max(scale, 0.2)))}px` }} />
        <span className="px-1 text-center font-semibold leading-tight" style={{ fontSize: `${Math.max(9, Math.min(14, 11 / Math.max(scale, 0.2)))}px` }}>
          The person filling this in chooses the picture
        </span>
      </div>
    );
  }

  const mode = modeOf(item);
  const fillable = item.kind === 'text' || item.kind === 'image';
  const cues = [];
  if (mode === 'ai') cues.push({ key: 'ai', label: 'The assistant writes it', Icon: Sparkles, tone: { background: '#eff6ff', color: '#2563eb', border: '#bfdbfe' } });
  if (mode === 'user') cues.push({ key: 'user', label: 'The person replaces it', Icon: ImagePlus, tone: { background: '#ecfdf5', color: '#047857', border: '#a7f3d0' } });
  if (mode === 'locked' && fillable) cues.push({ key: 'locked', label: 'Locked, part of the design', Icon: Lock, tone: { background: '#f1f5f9', color: '#475569', border: '#cbd5e1' } });
  if (cues.length === 0) return null;

  return (
    <div
      data-export-ignore="true"
      className="absolute flex items-center gap-1"
      style={{ left: 2, top: 2, zIndex: 4, pointerEvents: 'none' }}
    >
      {cues.map(({ key, label, Icon, tone }) => (
        <span
          key={key}
          title={label}
          aria-label={label}
          className="inline-flex items-center gap-1 px-1 font-semibold shadow-sm"
          style={cueStyle(scale, tone)}
        >
          <Icon aria-hidden="true" style={{ width: '1em', height: '1em' }} />
        </span>
      ))}
    </div>
  );
}

/**
 * One item's outline. It is memoized: a change to another item, or a style edit somewhere
 * else on the poster, never redraws this one.
 */
const ItemFrame = memo(function ItemFrame({ item, scale, selected, editing, hidden, guidesOn, registerFrame, onSelect, onStart, onEdit }) {
  const locked = Boolean(item.locked);
  const picture = item.kind === 'image' || item.field === 'photo';
  const pictureBlank = isUserImage(item) && !String(item.imageUrl || '').trim();
  const border = !guidesOn
    ? '1px solid transparent'
    : selected
    ? '1px dashed #2563eb'
    : locked
    ? '1px solid transparent'
    : hidden
    ? '1px dashed #94a3b8'
    : `1px dashed ${picture ? '#475569' : '#2563eb'}`;

  return (
    <div
      ref={(node) => registerFrame(item.id, node)}
      role="button"
      tabIndex={0}
      aria-label={`${itemLabel(item)}, ${item.w} by ${item.h} pixels, at ${item.x}, ${item.y}${
        modeAria(item) ? `, ${modeAria(item)}` : ''
      }${locked ? ', fixed in place' : ''}${hidden ? ', hidden while you edit' : ''}`}
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
      {guidesOn ? <ItemCues item={item} scale={scale} pictureBlank={pictureBlank} /> : null}
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
        className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-1 text-[12px] font-medium text-[#111827] hover:bg-[#F9FAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        style={{ pointerEvents: 'auto' }}
      >
        <Lock className="h-3 w-3 text-[#6B7280]" />
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
      className="absolute z-[45] w-[240px] rounded-[8px] border border-[#E5E7EB] bg-white p-3"
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
        <p className="flex-1 text-xs leading-relaxed text-[#6B7280]">
          {band === 'header'
            ? 'The top of every poster is your organization name and logo. It is the same on all your templates, so it is not placed here.'
            : 'The bottom of every poster carries your contact details. It is the same on all your templates, so it is not placed here.'}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-[4px] p-0.5 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Link
        to="/brand-kit"
        className="mt-2 inline-flex rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
      >
        Edit in Brand Kit
      </Link>
    </div>
  );
}

/** A CSS rule that hides the poster's own drawing of each hidden item, editor side only. */
function hiddenRulesOf(hiddenIds) {
  const ids = Array.from(hiddenIds || []).filter(Boolean);
  if (ids.length === 0) return '';
  /* An attribute selector takes the id as a quoted string, so a stray quote cannot escape. */
  return `[data-element="${ids.map((id) => String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"')).join('"], [data-element="')}"]{visibility:hidden}`;
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
  hiddenIds,
  zoom = 'fit',
  guidesOn = true,
  gridOn = false,
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
  onToggleGrid,
}) {
  const boxRef = useRef(null);
  const posterRef = useRef(null);
  const frames = useRef(new Map());
  const barRef = useRef(null);
  const tagRef = useRef(null);
  const guidesRef = useRef(null);
  const gesture = useRef(null);
  const rafRef = useRef(0);
  const pendingRef = useRef(null);
  const panRef = useRef(null);
  const anchorRef = useRef(null);
  const spaceRef = useRef(false);
  const [panMode, setPanMode] = useState(false);
  const [fitScale, setFitScale] = useState(0.5);
  const [bandPopover, setBandPopover] = useState(null);

  /* Read-latest refs: the gesture handlers are created once and must still see today's
     values, otherwise a move would be clamped against an out-of-date area or snap to
     items that have since moved. */
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
    onZoom,
  };
  const areaRef = useRef(area);
  areaRef.current = area;
  const listRef = useRef(items);
  listRef.current = items;
  const hiddenRef = useRef(hiddenIds);
  hiddenRef.current = hiddenIds;

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

  const percent = zoom === 'fit' ? Math.round(fitScale * 100) : Math.max(ZOOM_FLOOR, Math.min(ZOOM_CEILING, Number(zoom) || 100));
  const scale = Math.max(0.05, Math.min(4, percent / 100));

  /* Ctrl or Command with the wheel belongs to the canvas, not to the browser: without
     this the page itself would zoom. The listener is not passive, so it can say so. */
  useEffect(() => {
    const node = boxRef.current;
    if (!node || typeof node.addEventListener !== 'function') return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const step = event.deltaY > 0 ? -5 : 5;
      const next = Math.max(ZOOM_FLOOR, Math.min(ZOOM_CEILING, percent + step));
      if (next === percent) return;
      /* Keep the poster point under the cursor where it was, so the view does not jump. */
      const box = node.getBoundingClientRect();
      anchorRef.current = {
        ax: event.clientX - box.left,
        ay: event.clientY - box.top,
        px: (node.scrollLeft + event.clientX - box.left) / scale,
        py: (node.scrollTop + event.clientY - box.top) / scale,
      };
      actionsRef.current.onZoom?.(next);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [percent, scale]);

  /* Land the zoom under the cursor rather than under nothing. */
  useLayoutEffect(() => {
    const hold = anchorRef.current;
    if (!hold) return;
    anchorRef.current = null;
    const node = boxRef.current;
    if (!node) return;
    node.scrollLeft = hold.px * scale - hold.ax;
    node.scrollTop = hold.py * scale - hold.ay;
  }, [scale]);

  /* Hold Space and the canvas becomes a hand: dragging moves the view, not an item. */
  useEffect(() => {
    const editable = (node) =>
      Boolean(
        node &&
          (node.tagName === 'INPUT' ||
            node.tagName === 'TEXTAREA' ||
            node.tagName === 'SELECT' ||
            node.isContentEditable ||
            node.closest?.('button, a, [role="textbox"]'))
      );
    const down = (event) => {
      if (event.code !== 'Space' || event.repeat || editable(event.target)) return;
      spaceRef.current = true;
      setPanMode(true);
      event.preventDefault();
    };
    const up = (event) => {
      if (event.code !== 'Space') return;
      spaceRef.current = false;
      setPanMode(false);
    };
    const blur = () => {
      spaceRef.current = false;
      setPanMode(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const endPan = useCallback(() => {
    const state = panRef.current;
    panRef.current = null;
    window.removeEventListener('pointermove', state?.move);
    window.removeEventListener('pointerup', endPan);
    window.removeEventListener('pointercancel', endPan);
  }, []);

  const startPan = useCallback(
    (event) => {
      const node = boxRef.current;
      if (!node || event.button !== 0) return;
      const origin = { x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop };
      const move = (moveEvent) => {
        node.scrollLeft = origin.left - (moveEvent.clientX - origin.x);
        node.scrollTop = origin.top - (moveEvent.clientY - origin.y);
      };
      panRef.current = { move };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', endPan);
      window.addEventListener('pointercancel', endPan);
    },
    [endPan]
  );

  const selectedItem = useMemo(
    () => (Array.isArray(items) ? items.find((item) => item.id === selectedId) : null) || null,
    [items, selectedId]
  );

  /** The snap lines, drawn straight into their own layer so no React render is needed. */
  const drawGuides = useCallback((lines, boxSize, s) => {
    const host = guidesRef.current;
    if (!host) return;
    const key = `${lines.vertical.join(',')}|${lines.horizontal.join(',')}`;
    if (host.dataset.keys === key) return;
    host.dataset.keys = key;
    while (host.firstChild) host.removeChild(host.firstChild);
    lines.vertical.forEach((x) => {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;top:0;left:${whole(x * s) - 0.5}px;width:1px;height:${whole(
        boxSize.height * s
      )}px;background:${GUIDE_COLOR};pointer-events:none`;
      host.appendChild(line);
    });
    lines.horizontal.forEach((y) => {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;left:0;top:${whole(y * s) - 0.5}px;height:1px;width:${whole(
        boxSize.width * s
      )}px;background:${GUIDE_COLOR};pointer-events:none`;
      host.appendChild(line);
    });
  }, []);

  const clearGuides = useCallback(() => {
    const host = guidesRef.current;
    if (!host) return;
    host.dataset.keys = '';
    while (host.firstChild) host.removeChild(host.firstChild);
  }, []);

  /** Transform only, once per animation frame: no React render, no re-layout. */
  const paint = useCallback(() => {
    rafRef.current = 0;
    const state = gesture.current;
    const point = pendingRef.current;
    if (!state || !point) return;
    const dx = (point.x - state.startPoint.x) / state.scale;
    const dy = (point.y - state.startPoint.y) / state.scale;
    const raw =
      state.mode === 'move'
        ? moveRect(state.start, dx, dy, areaRef.current)
        : resizeRect(state.start, state.handle, dx, dy, { keepRatio: point.shift, area: areaRef.current });
    /* Snap to a guide when there is one within reach, then keep the box inside the area. */
    const snapped = nearestSnap(raw, state.targets, state.snapLimit, { mode: state.mode, handle: state.handle });
    const rect = snapped.rect;
    state.guides = snapped.guides;
    if (
      state.rect &&
      rect.x === state.rect.x &&
      rect.y === state.rect.y &&
      rect.w === state.rect.w &&
      rect.h === state.rect.h
    ) {
      drawGuides(state.guides, state.size, state.scale);
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
    drawGuides(state.guides, state.size, state.scale);
  }, [drawGuides]);

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
    clearGuides();
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
  }, [clearGuides, onPointerMove]);

  const begin = useCallback(
    (event, item, mode, handle) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (item.locked || (mode !== 'move' && mode !== 'resize')) return;
      /* Space means the hand is down: the view moves, the item does not. */
      if (spaceRef.current) return;
      const start = clampTo({ x: item.x, y: item.y, w: item.w, h: item.h }, areaRef.current);
      const targets = guideTargets(areaRef.current, listRef.current, item.id, {
        width: size.width,
        height: size.height,
        hidden: hiddenRef.current,
      });
      gesture.current = {
        id: item.id,
        mode,
        handle,
        start,
        rect: start,
        scale,
        size: { width: size.width, height: size.height },
        targets,
        guides: { vertical: [], horizontal: [] },
        /* Six poster pixels at full size, kept about six pixels on the screen as well. */
        snapLimit: guidesOn ? Math.min(24, Math.max(6, Math.round(6 / scale))) : 0,
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
    [scale, onPointerMove, endGesture, guidesOn, size.width, size.height]
  );

  const registerFrame = useCallback((id, node) => {
    if (node) frames.current.set(id, node);
    else frames.current.delete(id);
  }, []);

  const ordered = useMemo(() => (Array.isArray(items) ? items : []).slice().sort((a, b) => a.z - b.z), [items]);

  const barBox = barRectOf(selectedItem, area, scale);
  /* The position sheet opens above the bar when there is no room left below it. */
  const barOpensUp = Boolean(barBox) && barBox.top + 260 > whole(size.height * scale);

  const grid = gridOn ? gridBackgroundImage(size, scale) : null;
  const hiddenRules = hiddenRulesOf(hiddenIds);

  return (
    <div
      ref={boxRef}
      className="relative min-h-0 flex-1 overflow-auto bg-[#F3F4F6]"
      style={{ cursor: panMode ? 'grab' : undefined, touchAction: panMode ? 'none' : undefined }}
      onPointerDown={(event) => {
        setBandPopover(null);
        if (spaceRef.current) {
          event.preventDefault();
          startPan(event);
          return;
        }
        onCanvasClick?.();
      }}
    >
      <div className="flex min-h-full w-full" style={{ padding: 16 }}>
        <div
          className="relative shrink-0 overflow-hidden bg-white border border-[#E5E7EB]"
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
            <PosterCanvas brandKit={brandKit} template={template} content={content} isEditor={true} />
            {hiddenRules ? <style data-editor-hidden>{hiddenRules}</style> : null}
          </div>

          <div className="absolute inset-0" style={{ zIndex: 10 }}>
            {grid ? (
              <div
                data-editor-grid
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ backgroundImage: grid.backgroundImage, backgroundSize: grid.backgroundSize }}
              />
            ) : null}
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
                hidden={Boolean(hiddenIds?.has?.(item.id))}
                guidesOn={guidesOn}
                registerFrame={registerFrame}
                onSelect={onSelect}
                onStart={begin}
                onEdit={onStartEdit}
              />
            ))}

            <div ref={guidesRef} data-editor-guides aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ zIndex: 38 }} />

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
        className="absolute bottom-3 right-3 z-[50] flex items-center rounded-[6px] border border-[#E5E7EB] bg-white p-0.5"
        role="group"
        aria-label="Zoom"
      >
        {ZOOMS.map((step) => {
          const active = zoom === step || (step !== 'fit' && percent === step);
          return (
            <button
              key={step}
              type="button"
              aria-pressed={active}
              onClick={() => onZoom(step)}
              className={`min-w-[36px] rounded-[4px] px-2 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                active ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold' : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
              }`}
            >
              {step === 'fit' ? 'Fit' : `${step}%`}
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-3 left-3 z-[50] flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleGuides}
          aria-pressed={!guidesOn}
          className="rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          {guidesOn ? 'Hide guides' : 'Show guides'}
        </button>
        <button
          type="button"
          onClick={onToggleGrid}
          aria-pressed={gridOn}
          className="rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          {gridOn ? 'Hide grid' : 'Show grid'}
        </button>
      </div>

      <p className="absolute bottom-3 left-1/2 z-[49] -translate-x-1/2 text-xs text-[#6B7280]">
        {percent}% · {size.width} × {size.height}
        {panMode ? ' · holding Space: dragging moves the view' : ''}
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
