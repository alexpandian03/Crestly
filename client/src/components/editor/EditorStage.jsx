import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Lock, RotateCw, Sparkles } from 'lucide-react';
import PosterCanvas from '../PosterCanvas';
import ItemTextEditor from './ItemTextEditor';
import { BAND_HEIGHTS, ELEMENT_LIMITS, SECTION_LIMITS, resolveBrandText } from '../../../../shared/templateElements.js';
import {
  computeItemNumbers,
  isTypedText,
  isUserImage,
  itemLabel,
  missingBrandFields,
  modeOf,
} from '../../utils/templateEditorItems';
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

const SECTION_TAB_LABELS = {
  header: { key: 'header', label: 'Header' },
  content: { key: 'content', label: 'Content' },
  footer: { key: 'footer', label: 'Footer' },
};
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
const ZOOM_FLOOR = 25;
const ZOOM_CEILING = 400;
const GUIDE_COLOR = '#f43f5e';
/** Poster pixels kept clear of the edge inside every area. */
const MARGIN = 64;
/** Where each area's margin lines sit, so a band is never crossed by a box it does not own. */
const MARGIN_COLOR = '#93C5FD';
/** Grey margin around the poster inside the scroll area, in screen pixels. */
const STAGE_PADDING = 24;
/** How far the arrow keys carry the view when nothing is picked. */
const ARROW_SCROLL = 48;

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

const cornerHandleStyle = (key) => {
  const [fx, fy] = HANDLE_SPOTS[key];
  return {
    position: 'absolute',
    left: `${fx * 100}%`,
    top: `${fy * 100}%`,
    width: '12px',
    height: '12px',
    marginLeft: '-6px',
    marginTop: '-6px',
    background: '#ffffff',
    border: '2px solid #2563eb',
    borderRadius: '50%',
    boxSizing: 'border-box',
    cursor: CURSORS[key],
    touchAction: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
    zIndex: 35,
  };
};

const sideHandleStyle = (key) => {
  const [fx, fy] = HANDLE_SPOTS[key];
  const isHorizontal = key === 'n' || key === 's';
  return {
    position: 'absolute',
    left: `${fx * 100}%`,
    top: `${fy * 100}%`,
    width: isHorizontal ? '16px' : '6px',
    height: isHorizontal ? '6px' : '16px',
    marginLeft: isHorizontal ? '-8px' : '-3px',
    marginTop: isHorizontal ? '-3px' : '-8px',
    background: '#ffffff',
    border: '2px solid #2563eb',
    borderRadius: '9999px',
    boxSizing: 'border-box',
    cursor: isHorizontal ? 'ns-resize' : 'ew-resize',
    touchAction: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
    zIndex: 35,
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
function ItemCues({ item, scale, pictureBlank, numberInfo }) {
  if (pictureBlank) {
    return (
      <div
        data-export-ignore="true"
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-[3px] border border-dashed border-slate-300 bg-slate-100/90 text-slate-600"
        style={{ pointerEvents: 'none' }}
      >
        <ImagePlus className="w-4 h-4 text-slate-400" />
        <span
          className="px-1 text-center font-medium leading-tight truncate max-w-[90%]"
          style={{ fontSize: '11px', lineHeight: '14px' }}
        >
          {item.label || numberInfo?.label || 'Photo'}
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
const CORNER_KEYS = ['nw', 'ne', 'se', 'sw'];
const EDGE_KEYS = ['n', 'e', 's', 'w'];
const LOCK_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23374151\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Crect x=\'3\' y=\'11\' width=\'18\' height=\'11\' rx=\'2\' ry=\'2\'/%3E%3Cpath d=\'M7 11V7a5 5 0 0 1 10 0v4\'/%3E%3C/svg%3E") 10 10, not-allowed';

const ItemFrame = memo(function ItemFrame({
  item,
  scale,
  selected,
  isPrimarySelected: _isPrimarySelected = false,
  editing,
  hidden,
  guidesOn,
  registerFrame,
  onSelect,
  onStart,
  onEdit,
  onEditCard,
  onToggleLock: _onToggleLock,
  onDuplicate: _onDuplicate,
  onDelete: _onDelete,
  onReorder: _onReorder,
  onComment: _onComment,
  isNormalUser = false,
  onFitHeight = null,
  brandKit = null,
  onOpenBrandKit = null,
  numberInfo = null,
}) {
  const isHeaderOrFooter = item.section === 'header' || item.section === 'footer';
  const isNormalUserLocked = Boolean(isNormalUser && isHeaderOrFooter);
  const locked = Boolean(item.locked) || isNormalUserLocked;
  const picture = item.kind === 'image' || item.field === 'photo';
  const pictureBlank = isUserImage(item) && !String(item.imageUrl || '').trim();
  /* Words the brand kit is meant to supply but has not: the poster paints nothing there, so
     the editor says which field is missing instead of leaving a blank rectangle. */
  const blanks = missingBrandFields(String(item.text || ''), brandKit);
  const paintsNothing =
    blanks.length > 0 && !resolveBrandText(String(item.text || ''), brandKit).trim();
  const border = !guidesOn
    ? '1px solid transparent'
    : selected
    ? '2px solid #2563eb'
    : locked
    ? '1px solid transparent'
    : hidden
    ? '1px dashed #94a3b8'
    : `1px dashed ${picture ? '#475569' : '#2563eb'}`;

  // Automatically ensure text items tightly fit real rendered bounds
  useLayoutEffect(() => {
    if (!selected || (item.kind !== 'text' && !isTypedText(item))) return;
    const underlay = document.querySelector(`[data-element="${item.id}"]`);
    if (!underlay) return;
    const contentEl = underlay.querySelector('div') || underlay;
    const measuredH = contentEl.scrollHeight || contentEl.offsetHeight;
    if (measuredH > 0 && Math.abs(item.h - measuredH) > 4) {
      onFitHeight?.(item.id, measuredH);
    }
  }, [selected, item.id, item.kind, item.h, item.text, onFitHeight]);

  return (
    <div
      ref={(node) => registerFrame(item.id, node)}
      role="button"
      tabIndex={0}
      title={
        isNormalUserLocked
          ? 'Your organization keeps the header and footer exactly as set.'
          : locked
            ? 'Fixed in place. Press Unlock to move or change it.'
            : undefined
      }
      aria-label={`${itemLabel(item)}, ${item.w} by ${item.h} pixels, at ${item.x}, ${item.y}${
        modeAria(item) ? `, ${modeAria(item)}` : ''
      }${locked ? ', fixed in place' : ''}${hidden ? ', hidden while you edit' : ''}${
        paintsNothing ? `, waiting for ${blanks.join(' and ')} from the brand kit` : ''
      }`}
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
        cursor: isNormalUserLocked ? LOCK_CURSOR : (locked ? 'default' : 'move'),
        touchAction: 'none',
        zIndex: selected ? 30 : 20,
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
        transformOrigin: '50% 50%',
      }}
      onFocus={() => onSelect(item.id, item.section, false)}
      onPointerDown={(event) => {
        if (editing) return;
        event.stopPropagation();
        onSelect(item.id, item.section, event.shiftKey);
        if (!locked) onStart(event, item, 'move');
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onSelect(item.id, item.section, false);
        if (item.kind === 'cardlist') {
          onEditCard?.(item.id);
        } else if (isTypedText(item) && !locked) {
          onEdit(item.id);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSelect(item.id, item.section, false);
          if (item.kind === 'cardlist') {
            onEditCard?.(item.id);
          } else if (isTypedText(item) && !locked) {
            onEdit(item.id);
          }
        }
      }}
    >
      {/* 4 Round Corner Handles - Never shown when locked or normal-user locked */}
      {guidesOn && selected && !locked && !editing && !isNormalUserLocked
        ? CORNER_KEYS.map((key) => (
            <div
              key={key}
              data-handle={key}
              aria-hidden="true"
              style={cornerHandleStyle(key)}
              onPointerDown={(event) => {
                event.stopPropagation();
                onStart(event, item, 'resize', key);
              }}
            />
          ))
        : null}

      {/* 4 Pill Handles on the edges */}
      {guidesOn && selected && !locked && !editing && !isNormalUserLocked
        ? EDGE_KEYS.map((key) => (
            <div
              key={key}
              data-handle={key}
              aria-hidden="true"
              style={sideHandleStyle(key)}
              onPointerDown={(event) => {
                event.stopPropagation();
                onStart(event, item, 'resize', key);
              }}
            />
          ))
        : null}

      {/* Rotate Handle below the item */}
      {guidesOn && selected && !locked && !editing && !isNormalUserLocked ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto select-none"
          style={{
            top: '100%',
            zIndex: 36,
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            onStart(event, item, 'rotate');
          }}
        >
          {/* Stem line */}
          <div className="w-[1px] h-3.5 bg-[#2563eb]" />
          {/* Circular rotate button */}
          <div
            data-handle="rotate"
            title="Drag to rotate"
            className="w-5 h-5 rounded-full bg-white border-2 border-[#2563eb] shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-blue-50 transition-colors"
          >
            <RotateCw className="w-2.5 h-2.5 text-[#2563eb]" />
          </div>
        </div>
      ) : null}

      {isTypedText(item) && !String(item.text || '').trim() && !editing && !hidden ? (
        /* An empty box of words is a space to write in. Only the editor ever shows this note. */
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 pointer-events-none select-none text-[#94A3B8]"
          style={{
            fontSize: `${Math.max(9, Math.round(((item.style?.size || item.style?.fontSize || 16) * scale) * 0.9))}px`,
            fontStyle: 'italic',
            opacity: selected ? 0.95 : 0.6,
            whiteSpace: 'nowrap',
          }}
        >
          Type here
        </span>
      ) : null}

      {/* Top-right corner badge for variable items outside the text box */}
      {item.variable && numberInfo ? (
        <div
          data-export-ignore="true"
          className="absolute right-0 bottom-full mb-1 pointer-events-none select-none z-30"
          style={{ whiteSpace: 'nowrap' }}
        >
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] font-semibold shadow-xs border"
            style={{
              fontSize: '11px',
              lineHeight: '14px',
              backgroundColor: item.kind === 'image' ? '#ecfdf5' : '#eff6ff',
              color: item.kind === 'image' ? '#047857' : '#2563eb',
              borderColor: item.kind === 'image' ? '#a7f3d0' : '#bfdbfe',
            }}
          >
            {scale < 0.6 ? numberInfo.shortLabel : numberInfo.label}
          </span>
        </div>
      ) : null}

      {paintsNothing && !editing && !hidden ? (
        <div
          data-export-ignore="true"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center leading-tight rounded-[2px]"
          style={{
            border: '1px dashed #94a3b8',
            background: 'rgba(248,250,252,0.85)',
            color: '#475569',
            padding: '4px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 500 }}>
            {blanks.join(' + ')} (set it in Brand kit)
          </span>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onOpenBrandKit ? onOpenBrandKit() : (window.location.href = '/brand-kit');
            }}
            className="underline hover:text-[#2563EB] font-semibold transition-colors"
            style={{ fontSize: '11px', color: '#2563EB' }}
          >
            Open Brand kit
          </button>
        </div>
      ) : null}

      {guidesOn ? <ItemCues item={item} scale={scale} pictureBlank={pictureBlank} numberInfo={numberInfo} /> : null}
    </div>
  );
});

/** A CSS rule that hides the poster's own drawing of each hidden item, editor side only. */
function hiddenRulesOf(hiddenIds) {
  const ids = Array.from(hiddenIds || []).filter(Boolean);
  if (ids.length === 0) return '';
  /* An attribute selector takes the id as a quoted string, so a stray quote cannot escape. */
  return `[data-element="${ids.map((id) => String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"')).join('"], [data-element="')}"]{visibility:hidden}`;
}

function PosterRulers({ width, height, scale }) {
  const scaledW = Math.round(width * scale);
  const scaledH = Math.round(height * scale);

  const xTicks = [];
  for (let x = 0; x <= width; x += 50) {
    xTicks.push(x);
  }
  const yTicks = [];
  for (let y = 0; y <= height; y += 50) {
    yTicks.push(y);
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute select-none text-[9px] font-mono text-slate-400 overflow-hidden"
        style={{
          left: 0,
          top: '-20px',
          width: `${scaledW}px`,
          height: '20px',
          borderBottom: '1px solid #cbd5e1',
          backgroundColor: '#f8fafc',
          zIndex: 25,
        }}
      >
        <svg width={scaledW} height="20" className="block">
          {xTicks.map((x) => {
            const sx = Math.round(x * scale);
            const isMajor = x % 100 === 0;
            return (
              <g key={`x-${x}`}>
                <line
                  x1={sx}
                  y1={isMajor ? 8 : 14}
                  x2={sx}
                  y2={20}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                {isMajor && (
                  <text x={sx + 2} y={10} fill="#64748b" fontSize="8" fontFamily="monospace">
                    {x}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute select-none text-[9px] font-mono text-slate-400 overflow-hidden"
        style={{
          left: '-20px',
          top: 0,
          width: '20px',
          height: `${scaledH}px`,
          borderRight: '1px solid #cbd5e1',
          backgroundColor: '#f8fafc',
          zIndex: 25,
        }}
      >
        <svg width="20" height={scaledH} className="block">
          {yTicks.map((y) => {
            const sy = Math.round(y * scale);
            const isMajor = y % 100 === 0;
            return (
              <g key={`y-${y}`}>
                <line
                  x1={isMajor ? 8 : 14}
                  y1={sy}
                  x2={20}
                  y2={sy}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                {isMajor && (
                  <text
                    x={2}
                    y={sy - 2}
                    fill="#64748b"
                    fontSize="8"
                    fontFamily="monospace"
                    transform={`rotate(-90 8 ${sy})`}
                  >
                    {y}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </>
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
  selectedIds = null,
  editingId,
  hiddenIds,
  activeSection = 'content',
  sections = null,
  sectionTabs = null,
  brandLayer = false,
  onSectionChange = null,
  showFullPoster = false,
  onSwitchSection,
  onToggleShowFullPoster,
  zoom = 'fit',
  guidesOn = true,
  gridOn = false,
  rulersOn = false,
  onSelect,
  onSelectMultiple = null,
  onStartEdit,
  onEditCard = null,
  onStopEdit,
  onCommitText,
  onCanvasClick,
  onCommitRect,
  onCommitMultiMove = null,
  onCommitRotation = null,
  onFitHeight = null,
  onToggleLock,
  onDuplicate,
  onDelete,
  onReorder,
  onZoom,
  onToggleGuides: _onToggleGuides,
  onToggleGrid: _onToggleGrid,
  onOverflow,
  onComment = null,
  isNormalUser = false,
  onScaleChange = null,
  onDropImage = null,
  onOpenBrandKit = null,
}) {
  const boxRef = useRef(null);
  const controlsRef = useRef(null);
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
  const [fillWidthScale, setFillWidthScale] = useState(0.8);
  const [isAnimating, setIsAnimating] = useState(false);
  const [marginOn, setMarginOn] = useState({ header: false, content: true, footer: false });
  const [marqueeRect, setMarqueeRect] = useState(null);
  const marqueeRef = useRef(null);
  const animTimer = useRef(0);

  /* Read-latest refs: the gesture handlers are created once and must still see today's
     values, otherwise a move would be clamped against an out-of-date area or snap to
     items that have since moved. */
  const actionsRef = useRef({});
  actionsRef.current = {
    onSelect,
    onSelectMultiple,
    onCommitRect,
    onCommitMultiMove,
    onCommitRotation,
    onFitHeight,
    onCommitText,
    onStartEdit,
    onToggleLock,
    onDuplicate,
    onDelete,
    onReorder,
    onZoom,
    onCanvasClick,
    onSectionChange,
  };
  const areaRef = useRef(area);
  areaRef.current = area;
  const listRef = useRef(items);
  listRef.current = items;
  const hiddenRef = useRef(hiddenIds);
  hiddenRef.current = hiddenIds;

  const selectedIdsList = useMemo(() => {
    if (selectedIds && Array.isArray(selectedIds) && selectedIds.length > 0) return selectedIds;
    return selectedId ? [selectedId] : [];
  }, [selectedIds, selectedId]);
  const selectedIdsRef = useRef(selectedIdsList);
  selectedIdsRef.current = selectedIdsList;

  const headerH = sections?.header?.height ?? (brandKit?.header?.height ?? BAND_HEIGHTS.header.default);
  const footerH = sections?.footer?.height ?? (brandKit?.footer?.height ?? BAND_HEIGHTS.footer.default);
  const contentH = Math.max(0, size.height - headerH - footerH);

  const minHeaderH = brandLayer ? (BAND_HEIGHTS.header?.min ?? 60) : (SECTION_LIMITS.header?.minHeight ?? 60);
  const maxHeaderH = brandLayer ? (BAND_HEIGHTS.header?.max ?? 200) : (SECTION_LIMITS.header?.maxHeight ?? 260);
  const minFooterH = brandLayer ? (BAND_HEIGHTS.footer?.min ?? 60) : (SECTION_LIMITS.footer?.minHeight ?? 60);
  const maxFooterH = brandLayer ? (BAND_HEIGHTS.footer?.max ?? 260) : (SECTION_LIMITS.footer?.maxHeight ?? 260);

  const activeMinH = activeSection === 'header' ? minHeaderH : minFooterH;
  const activeMaxH = activeSection === 'header' ? maxHeaderH : maxFooterH;
  const activeCurrentH = activeSection === 'header' ? headerH : footerH;

  /** Measure fit scale and fillWidth scale */
  useLayoutEffect(() => {
    const measure = () => {
      const node = boxRef.current;
      if (!node) return;
      const controlsH = controlsRef.current ? controlsRef.current.offsetHeight + 12 : 84;
      const availW = Math.max(100, node.clientWidth - STAGE_PADDING * 2);
      const availH = Math.max(100, node.clientHeight - STAGE_PADDING * 2 - controlsH);

      const computedFit = Math.max(0.05, Math.min(2.0, Math.min(availW / size.width, availH / size.height)));
      const computedFillWidth = Math.max(0.15, Math.min(2.5, availW / size.width));

      setFitScale((prev) => (Math.abs(prev - computedFit) < 0.0005 ? prev : computedFit));
      setFillWidthScale((prev) => (Math.abs(prev - computedFillWidth) < 0.0005 ? prev : computedFillWidth));
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

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(animTimer.current);
    },
    []
  );

  const effectiveFitScale = showFullPoster ? fitScale : fillWidthScale;
  const scale =
    zoom === 'fit'
      ? effectiveFitScale
      : Math.max(ZOOM_FLOOR / 100, Math.min(ZOOM_CEILING / 100, (Number(zoom) || 100) / 100));

  useEffect(() => {
    onScaleChange?.(scale, fitScale);
  }, [scale, fitScale, onScaleChange]);

const startResizeSection = useCallback(
    (event, sectionToResize) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (!onSectionChange) return;
      event.preventDefault();
      event.stopPropagation();

      const isHdr = sectionToResize === 'header';
      const initialHeight = isHdr ? headerH : footerH;
      const startClientY = event.clientY;
      const minH = isHdr ? minHeaderH : minFooterH;
      const maxH = isHdr ? maxHeaderH : maxFooterH;

      const handlePointerMove = (e) => {
        const deltaScreenY = e.clientY - startClientY;
        const deltaPosterY = deltaScreenY / scale;
        const newHeightRaw = isHdr
          ? initialHeight + deltaPosterY
          : initialHeight - deltaPosterY;
        const clampedHeight = Math.max(minH, Math.min(maxH, Math.round(newHeightRaw / 2) * 2));
        onSectionChange(sectionToResize, { height: clampedHeight });
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [footerH, headerH, maxFooterH, maxHeaderH, minFooterH, minHeaderH, onSectionChange, scale],
  );

  /* Step into an area and the view carries you there; step back and it puts you where you
     left off. Scroll is remembered in poster pixels, so it survives a change of zoom. */
  const scrollMemory = useRef(new Map());
  const focusRef = useRef({ key: null, scale: 1 });
  const settleUntil = useRef(0);
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return undefined;
    const key = showFullPoster ? 'whole' : activeSection;
    const leaving = focusRef.current.key;
    const keyChanged = leaving !== key;
    if (keyChanged) {
      if (leaving) {
        scrollMemory.current.set(leaving, {
          top: node.scrollTop / focusRef.current.scale,
          left: node.scrollLeft / focusRef.current.scale,
        });
      }
      focusRef.current.key = key;
      setIsAnimating(true);
      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => setIsAnimating(false), 220);
    }
    focusRef.current.scale = scale;
    /* Only settle for a moment after the area changes. Afterwards the view belongs to
       whoever is scrolling, and a zoom under the cursor must stay where it landed. */
    if (!keyChanged && Date.now() > settleUntil.current) return;
    settleUntil.current = Date.now() + 260;

    const controlsH = controlsRef.current?.offsetHeight ?? 84;
    let top = 0;
    if (!showFullPoster) {
      const bandTop =
        activeSection === 'footer' ? size.height - footerH : activeSection === 'content' ? headerH : 0;
      const remembered = scrollMemory.current.get(key);
      top = remembered
        ? remembered.top * scale
        : Math.max(0, STAGE_PADDING + bandTop * scale - controlsH - 8);
    }
    node.scrollTo({ top, left: node.scrollLeft, behavior: 'smooth' });
  }, [activeSection, showFullPoster, scale, headerH, footerH, size.height]);

  /* Ctrl or Command with the wheel belongs to the canvas, not to the browser. A plain wheel
     is left alone so the page scrolls the way every other page does; Shift steers sideways. */
  useEffect(() => {
    const node = boxRef.current;
    if (!node || typeof node.addEventListener !== 'function') return undefined;
    const onWheel = (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const step = event.deltaY > 0 ? -5 : 5;
        const currentPercent = Math.round(scale * 100);
        const next = Math.max(ZOOM_FLOOR, Math.min(ZOOM_CEILING, currentPercent + step));
        if (next === currentPercent) return;
        const box = node.getBoundingClientRect();
        anchorRef.current = {
          ax: event.clientX - box.left,
          ay: event.clientY - box.top,
          px: (node.scrollLeft + event.clientX - box.left) / scale,
          py: (node.scrollTop + event.clientY - box.top) / scale,
        };
        actionsRef.current.onZoom?.(next);
        return;
      }
      if (event.shiftKey && !event.deltaX) {
        event.preventDefault();
        node.scrollLeft += event.deltaY;
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [scale]);

  /* With nothing picked, the arrows move the view rather than an item. */
  useEffect(() => {
    const step = (event) => {
      const node = boxRef.current;
      if (!node) return;
      const amount = event.shiftKey ? 8 : ARROW_SCROLL;
      if (event.key === 'ArrowUp') node.scrollTop -= amount;
      else if (event.key === 'ArrowDown') node.scrollTop += amount;
      else if (event.key === 'ArrowLeft') node.scrollLeft -= amount;
      else node.scrollLeft += amount;
      event.preventDefault();
    };
    const onKey = (event) => {
      if (!event.key.startsWith('Arrow') || event.altKey || event.ctrlKey || event.metaKey) return;
      if (selectedIdsRef.current.length > 0) return;
      if (editingId) return;
      const node = event.target;
      if (
        node &&
        (node.tagName === 'INPUT' ||
          node.tagName === 'TEXTAREA' ||
          node.tagName === 'SELECT' ||
          node.isContentEditable)
      )
        return;
      step(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId]);

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

  /* Hold Space and the canvas becomes a hand */
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
      if (!node || (event.button !== 0 && event.button !== 1)) return;
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

  /* All items across all sections */
  const allEditorItems = useMemo(() => {
    if (!sections) {
      return (Array.isArray(items) ? items : []).map((it) => ({
        ...it,
        section: it.section || activeSection,
      }));
    }
    const headerEls = (sections.header?.elements || []).map((it) => ({
      ...it,
      section: 'header',
    }));
    const contentEls = (sections.content?.elements || []).map((it) => ({
      ...it,
      section: 'content',
    }));
    const footerEls = (sections.footer?.elements || []).map((it) => ({
      ...it,
      section: 'footer',
    }));
    return [...headerEls, ...contentEls, ...footerEls];
  }, [sections, items, activeSection]);

  const allEditorItemsRef = useRef(allEditorItems);
  allEditorItemsRef.current = allEditorItems;

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    const fromActive = allEditorItems.find(
      (item) => item.id === selectedId && item.section === activeSection
    );
    if (fromActive) return fromActive;
    return allEditorItems.find((item) => item.id === selectedId) || null;
  }, [allEditorItems, selectedId, activeSection]);

  const editingItem = useMemo(() => {
    if (!editingId) return null;
    const fromActive = allEditorItems.find(
      (item) => item.id === editingId && item.section === activeSection
    );
    if (fromActive) return fromActive;
    return allEditorItems.find((item) => item.id === editingId) || selectedItem;
  }, [allEditorItems, editingId, activeSection, selectedItem]);

  const handleItemSelect = useCallback(
    (id, itemSection, isShift = false) => {
      if (itemSection && itemSection !== activeSection) {
        onSwitchSection?.(itemSection, id);
      } else {
        if (!isShift) {
          const target =
            allEditorItemsRef.current.find(
              (it) => it.id === id && it.section === (itemSection || activeSection)
            ) || allEditorItemsRef.current.find((it) => it.id === id);
          if (target?.groupId) {
            const groupIds = allEditorItemsRef.current
              .filter((it) => it.section === activeSection && it.groupId === target.groupId)
              .map((it) => it.id);
            if (groupIds.length > 1) {
              actionsRef.current.onSelectMultiple?.(groupIds, false);
              return;
            }
          }
        }
        onSelect?.(id, isShift);
      }
    },
    [activeSection, onSwitchSection, onSelect]
  );

  const startMarquee = useCallback(
    (event) => {
      if (event.button !== 0 || spaceRef.current) return;
      const startX = event.clientX;
      const startY = event.clientY;
      marqueeRef.current = { startX, startY, active: false };

      const onMarqueeMove = (moveEvent) => {
        const state = marqueeRef.current;
        if (!state) return;
        const curX = moveEvent.clientX;
        const curY = moveEvent.clientY;
        const dist = Math.hypot(curX - state.startX, curY - state.startY);
        if (dist > 4) {
          state.active = true;
          const left = Math.min(state.startX, curX);
          const top = Math.min(state.startY, curY);
          const width = Math.abs(curX - state.startX);
          const height = Math.abs(curY - state.startY);
          setMarqueeRect({ left, top, width, height });

          const intersectingIds = [];
          for (const item of allEditorItemsRef.current) {
            if (item.section !== activeSection) continue;
            const node = frames.current.get(item.id);
            if (!node) continue;
            const rect = node.getBoundingClientRect();
            if (
              rect.left < left + width &&
              rect.right > left &&
              rect.top < top + height &&
              rect.bottom > top
            ) {
              intersectingIds.push(item.id);
            }
          }
          actionsRef.current.onSelectMultiple?.(intersectingIds, moveEvent.shiftKey);
        }
      };

      const endMarquee = () => {
        const state = marqueeRef.current;
        marqueeRef.current = null;
        setMarqueeRect(null);
        window.removeEventListener('pointermove', onMarqueeMove);
        window.removeEventListener('pointerup', endMarquee);
        window.removeEventListener('pointercancel', endMarquee);
        if (!state?.active) {
          actionsRef.current.onCanvasClick?.();
        }
      };

      window.addEventListener('pointermove', onMarqueeMove);
      window.addEventListener('pointerup', endMarquee);
      window.addEventListener('pointercancel', endMarquee);
    },
    [activeSection]
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

    if (state.mode === 'rotate') {
      const rad = Math.atan2(point.y - state.center.y, point.x - state.center.x);
      let deg = Math.round(((rad * 180) / Math.PI) - 90);
      deg = (((deg + 180) % 360) + 360) % 360 - 180;
      if (point.shift) {
        deg = Math.round(deg / 15) * 15;
      } else {
        for (const snap of [0, 90, 180, -90]) {
          if (Math.abs(deg - snap) <= 5) {
            deg = snap;
            break;
          }
        }
      }
      state.rotation = deg;
      const frame = frames.current.get(state.id);
      if (frame) {
        frame.style.transform = `rotate(${deg}deg)`;
      }
      if (state.underlay) {
        state.underlay.style.transform = `rotate(${deg}deg)`;
      }
      if (tagRef.current) tagRef.current.textContent = `${deg}°`;
      return;
    }

    const dx = (point.x - state.startPoint.x) / state.scale;
    const dy = (point.y - state.startPoint.y) / state.scale;

    if (state.isMulti && state.multiItems?.length > 1) {
      const area = areaRef.current;
      let minDx = -Infinity;
      let maxDx = Infinity;
      let minDy = -Infinity;
      let maxDy = Infinity;

      for (const entry of state.multiItems) {
        minDx = Math.max(minDx, area.x - entry.start.x);
        maxDx = Math.min(maxDx, (area.x + area.w) - (entry.start.x + entry.start.w));
        minDy = Math.max(minDy, area.y - entry.start.y);
        maxDy = Math.min(maxDy, (area.y + area.h) - (entry.start.y + entry.start.h));
      }

      const clampedDx = whole(Math.max(minDx, Math.min(maxDx, dx)));
      const clampedDy = whole(Math.max(minDy, Math.min(maxDy, dy)));
      state.multiDx = clampedDx;
      state.multiDy = clampedDy;

      for (const entry of state.multiItems) {
        const frame = frames.current.get(entry.id);
        const tx = whole(clampedDx * state.scale);
        const ty = whole(clampedDy * state.scale);
        const rot = entry.rotation ? ` rotate(${entry.rotation}deg)` : '';
        if (frame) {
          frame.style.transform = `translate3d(${tx}px, ${ty}px, 0)${rot}`;
        }
        if (entry.underlay) {
          entry.underlay.style.transform = `translate3d(${tx}px, ${ty}px, 0)${rot}`;
        }
      }
      return;
    }

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
    const rot = state.rotation ? ` rotate(${state.rotation}deg)` : '';
    const frame = frames.current.get(state.id);
    if (frame) {
      frame.style.transform =
        state.mode === 'move'
          ? `translate3d(${tx}px, ${ty}px, 0)${rot}`
          : `translate3d(${tx}px, ${ty}px, 0) scale(${sx}, ${sy})${rot}`;
      if (state.mode === 'resize') {
        frame.querySelectorAll('[data-handle]').forEach((handle) => {
          handle.style.transform = `scale(${1 / sx}, ${1 / sy})`;
        });
      }
    }
    /* The words themselves only shift sideways or down: stretching them would lie about
       how many lines they need, and the real fit runs when the numbers are committed. */
    if (state.underlay) {
      state.underlay.style.transform =
        state.mode === 'move'
          ? `translate3d(${tx}px, ${ty}px, 0)${rot}`
          : `translate3d(${tx}px, ${ty}px, 0) scale(${sx}, ${sy})${rot}`;
    }
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

    if (state.mode === 'rotate') {
      const frame = frames.current.get(state.id);
      if (frame) {
        frame.style.transform = state.rotation ? `rotate(${state.rotation}deg)` : '';
      }
      if (state.underlay) {
        state.underlay.style.transform = state.rotation ? `rotate(${state.rotation}deg)` : '';
      }
      if (state.rotation !== undefined && state.rotation !== state.startRotation) {
        actionsRef.current.onCommitRotation?.(state.id, state.rotation);
      }
      return;
    }

    if (state.isMulti && state.multiItems?.length > 1) {
      for (const entry of state.multiItems) {
        const frame = frames.current.get(entry.id);
        const rot = entry.rotation ? `rotate(${entry.rotation}deg)` : '';
        if (frame) frame.style.transform = rot;
        if (entry.underlay) entry.underlay.style.transform = rot;
      }
      if (state.multiDx || state.multiDy) {
        const moves = state.multiItems.map((entry) => ({
          id: entry.id,
          rect: {
            x: entry.start.x + (state.multiDx || 0),
            y: entry.start.y + (state.multiDy || 0),
            w: entry.start.w,
            h: entry.start.h,
          },
        }));
        actionsRef.current.onCommitMultiMove?.(moves);
      }
      return;
    }

    const frame = frames.current.get(state.id);
    const rot = state.rotation ? `rotate(${state.rotation}deg)` : '';
    if (frame) {
      frame.style.transform = rot;
      frame.querySelectorAll('[data-handle]').forEach((handle) => {
        handle.style.transform = '';
      });
    }
    if (state.underlay) state.underlay.style.transform = rot;
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
      if (item.locked && mode !== 'rotate') return;
      /* Space means the hand is down: the view moves, the item does not. */
      if (spaceRef.current) return;

      if (mode === 'rotate') {
        const frame = frames.current.get(item.id);
        const rect = frame ? frame.getBoundingClientRect() : null;
        const cx = rect ? rect.left + rect.width / 2 : event.clientX;
        const cy = rect ? rect.top + rect.height / 2 : event.clientY;
        gesture.current = {
          id: item.id,
          mode: 'rotate',
          startRotation: Number(item.rotation) || 0,
          rotation: Number(item.rotation) || 0,
          center: { x: cx, y: cy },
          scale,
          underlay: posterRef.current?.querySelector(`[data-element="${item.id}"]`) || null,
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', endGesture);
        window.addEventListener('pointercancel', endGesture);
        return;
      }

      const isMulti = selectedIdsRef.current.length > 1 && selectedIdsRef.current.includes(item.id);
      const multiItems = isMulti
        ? allEditorItemsRef.current
            .filter((it) => selectedIdsRef.current.includes(it.id) && it.section === activeSection && !it.locked)
            .map((it) => ({
              id: it.id,
              start: clampTo({ x: it.x, y: it.y, w: it.w, h: it.h }, areaRef.current),
              rotation: Number(it.rotation) || 0,
              underlay: posterRef.current?.querySelector(`[data-element="${it.id}"]`) || null,
            }))
        : null;

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
        isMulti,
        multiItems,
        start,
        rect: start,
        rotation: Number(item.rotation) || 0,
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
    [scale, onPointerMove, endGesture, guidesOn, size.width, size.height, activeSection]
  );

  const registerFrame = useCallback((id, node) => {
    if (node) frames.current.set(id, node);
    else frames.current.delete(id);
  }, []);

  const ordered = useMemo(() => {
    return allEditorItems.slice().sort((a, b) => {
      if (a.section !== b.section) {
        const order = { header: 1, content: 2, footer: 3 };
        return (order[a.section] || 2) - (order[b.section] || 2);
      }
      return a.z - b.z;
    });
  }, [allEditorItems]);

  const itemNumbers = useMemo(() => computeItemNumbers(allEditorItems), [allEditorItems]);

  const grid = gridOn ? gridBackgroundImage(size, scale) : null;
  const hiddenRules = hiddenRulesOf(hiddenIds);

  /* Where each area sits on the poster, so its boxes can be kept inside it. */
  const sectionBands = [
    { key: 'header', top: 0, height: headerH },
    { key: 'content', top: headerH, height: contentH },
    { key: 'footer', top: Math.max(0, size.height - footerH), height: footerH },
  ];

  /* Which areas this screen lets you step into. The brand layer has no content of its own. */
  const tabs = (sectionTabs || ['header', 'content', 'footer'])
    .map((key) => SECTION_TAB_LABELS[key])
    .filter(Boolean);
  const showsContent = tabs.some((entry) => entry.key === 'content');

  /* Margin lines follow the area you are working in. A band only ever gets its own two side
     lines and a centre line, so no line is ever drawn across the edge of a band. */
  const visibleBands = (
    showFullPoster ? sectionBands : sectionBands.filter((band) => band.key === activeSection)
  ).filter((band) => band.height > 0);
  const guideBands = visibleBands.filter((band) => marginOn[band.key]);
  const marginGuides =
    size.width > MARGIN * 2
      ? guideBands.map((band) => ({
          key: band.key,
          top: band.top,
          height: band.height,
          lines: [
            { axis: 'v', at: MARGIN },
            { axis: 'v', at: size.width - MARGIN },
            ...(band.key === 'content'
              ? band.height > MARGIN * 2
                ? [
                    { axis: 'h', at: band.top + MARGIN },
                    { axis: 'h', at: band.top + band.height - MARGIN },
                  ]
                : []
              : [{ axis: 'h', at: band.top + band.height / 2 }]),
          ],
        }))
      : [];
  const toggleMargins = () =>
    setMarginOn((prev) => ({ ...prev, [activeSection]: !prev[activeSection] }));

  return (
    <div
      ref={boxRef}
      data-editor-workspace
      className="relative min-h-0 flex-1 overflow-auto bg-[#F3F4F6]"
      style={{
        cursor: panMode ? 'grab' : undefined,
        touchAction: panMode ? 'none' : undefined,
        scrollbarColor: '#CBD5E1 #F3F4F6',
        scrollbarWidth: 'thin',
      }}
      onPointerDown={(event) => {
        /* The controls above the poster, their popovers and every dropdown live inside this
           workspace. A click on one of them must never start a rubber-band, because a
           rubber-band that goes nowhere ends by clearing the selection - which closes the panel
           the click just opened. */
        if (event.target?.closest?.('[data-editor-ui]')) return;
        if (event.button === 1) {
          event.preventDefault();
          startPan(event);
          return;
        }
        if (spaceRef.current) {
          event.preventDefault();
          startPan(event);
          return;
        }
        startMarquee(event);
      }}
    >
      <style>{`
        [data-editor-workspace]::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        [data-editor-workspace]::-webkit-scrollbar-track {
          background: #F3F4F6;
        }
        [data-editor-workspace]::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border: 3px solid #F3F4F6;
          border-radius: 8px;
        }
      `}</style>

      {marqueeRect ? (
        <div
          data-marquee-selection
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: `${marqueeRect.left}px`,
            top: `${marqueeRect.top}px`,
            width: `${marqueeRect.width}px`,
            height: `${marqueeRect.height}px`,
            border: '1px solid #2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        />
      ) : null}

      <div
        className="min-h-full flex flex-col items-center box-border"
        style={{
          /* A wide row of controls must never widen this strip. It asks only for the room the
             poster needs, so the strip stays exactly as wide as the visible poster. */
          minWidth: '100%',
          minHeight: 'max-content',
          padding: STAGE_PADDING,
        }}
      >
        <div className="flex flex-col items-center" style={{ width: 'max-content', maxWidth: '100%' }}>
          {/* Controls: section tabs and margin switch, pinned while the poster scrolls. The
              item toolbar itself sits above this stage, once. */}
          <div
            ref={controlsRef}
            data-editor-controls="true"
            data-editor-ui="true"
            className="sticky top-0 flex flex-col items-center gap-1.5 mb-2 z-40 select-none self-stretch"
          >
            {/* Section tabs row: [Header | Content | Footer] & [Height Adjuster] & [Margin lines] */}
            <div className="flex items-center justify-between w-full max-w-[760px] px-2 gap-3 flex-wrap sm:flex-nowrap">
              <div
                role="tablist"
                aria-label="Poster sections"
                className="flex items-center rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] p-0.5 shadow-xs"
              >
                {tabs.map(({ key, label }) => {
                  const active = activeSection === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onSwitchSection?.(key)}
                      className={`rounded-[4px] px-3 py-1 text-xs transition-colors font-medium ${
                        active
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-[#6B7280] hover:text-[#111827]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Prominent Height Adjuster for Header and Footer */}
              {activeSection !== 'content' && onSectionChange && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-[#E5E7EB] bg-white shadow-xs">
                  <span className="text-xs font-medium text-[#4B5563]">
                    {activeSection === 'header' ? 'Header height:' : 'Footer height:'}
                  </span>
                  <button
                    type="button"
                    title={activeSection === 'header' ? 'Make header smaller' : 'Make footer smaller'}
                    onClick={() => {
                      const next = Math.max(activeMinH, activeCurrentH - 10);
                      onSectionChange(activeSection, { height: next });
                    }}
                    className="h-5 w-5 flex items-center justify-center rounded border border-[#E5E7EB] text-xs font-bold text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
                    aria-label="Decrease section height"
                  >
                    −
                  </button>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      value={activeCurrentH}
                      min={activeMinH}
                      max={activeMaxH}
                      step={10}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          onSectionChange(activeSection, {
                            height: Math.max(activeMinH, Math.min(activeMaxH, val)),
                          });
                        }
                      }}
                      className="w-12 text-center font-mono text-xs tabular-nums font-semibold text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                    />
                    <span className="text-[11px] font-medium text-[#6B7280]">px</span>
                  </div>
                  <button
                    type="button"
                    title={activeSection === 'header' ? 'Make header bigger' : 'Make footer bigger'}
                    onClick={() => {
                      const next = Math.min(activeMaxH, activeCurrentH + 10);
                      onSectionChange(activeSection, { height: next });
                    }}
                    className="h-5 w-5 flex items-center justify-center rounded border border-[#E5E7EB] text-xs font-bold text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
                    aria-label="Increase section height"
                  >
                    +
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleMargins}
                  aria-pressed={marginOn[activeSection]}
                  title={marginOn[activeSection] ? 'Hide the margin lines' : 'Show the margin lines'}
                  className={`rounded-[6px] border px-3 py-1 text-xs font-medium transition-colors shadow-xs ${
                    marginOn[activeSection]
                      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                      : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                  }`}
                >
                  Margin lines
                </button>

                <button
                  type="button"
                  onClick={onToggleShowFullPoster}
                  aria-pressed={showFullPoster}
                  className={`rounded-[6px] border px-3 py-1 text-xs font-medium transition-colors shadow-xs ${
                    showFullPoster
                      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                      : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]'
                  }`}
                >
                  Whole poster
                </button>
              </div>
            </div>
          </div>

          {/* Poster Wrapper with optional Rulers */}
          <div className="relative">
            {rulersOn ? <PosterRulers width={size.width} height={size.height} scale={scale} /> : null}
            <div
              className="relative shrink-0 overflow-hidden bg-white border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.08)] rounded-[2px]"
              style={{
                width: `${whole(size.width * scale)}px`,
                height: `${whole(size.height * scale)}px`,
                transition: isAnimating ? 'width 200ms ease-out, height 200ms ease-out' : undefined,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const url = e.dataTransfer.getData('text/plain');
                if (url && onDropImage) {
                  onDropImage(url);
                }
              }}
            >
            <div
              ref={posterRef}
              data-editor-poster="true"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${size.width}px`,
                height: `${size.height}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                pointerEvents: 'none',
                transition: isAnimating ? 'transform 200ms ease-out' : undefined,
              }}
            >
              <PosterCanvas
                brandKit={brandKit}
                template={template}
                content={content}
                isEditor={true}
                activeSection={activeSection}
                onOverflow={onOverflow}
              />
              {hiddenRules ? <style data-editor-hidden>{hiddenRules}</style> : null}
            </div>

            <div className="absolute inset-0" style={{ zIndex: 10 }}>
              {/* The grid is measured from the top of the area being edited, so it never paints
                  over the dimmed areas above or below it. */}
              {grid
                ? visibleBands.map((band) => {
                    const offset = whole(band.top * scale);
                    return (
                      <div
                        key={`grid-${band.key}`}
                        data-editor-grid={band.key}
                        aria-hidden="true"
                        className="pointer-events-none absolute overflow-hidden"
                        style={{
                          left: 0,
                          top: `${offset}px`,
                          width: `${whole(size.width * scale)}px`,
                          height: `${whole(band.height * scale)}px`,
                        }}
                      >
                        <div
                          className="pointer-events-none absolute"
                          style={{
                            left: 0,
                            top: `${-offset}px`,
                            width: `${whole(size.width * scale)}px`,
                            height: `${whole(size.height * scale)}px`,
                            backgroundImage: grid.backgroundImage,
                            backgroundSize: grid.backgroundSize,
                          }}
                        />
                      </div>
                    );
                  })
                : null}

              {/* Margin lines: only the area being edited, and only inside that area. Drawn
                  before the item boxes so a handle is always on top, and never clickable. */}
              {marginGuides.map((guide) => (
                <div
                  key={`margin-${guide.key}`}
                  data-margin-guides={guide.key}
                  aria-hidden="true"
                  className="pointer-events-none absolute overflow-hidden"
                  style={{
                    left: 0,
                    top: `${whole(guide.top * scale)}px`,
                    width: `${whole(size.width * scale)}px`,
                    height: `${whole(guide.height * scale)}px`,
                    zIndex: 9,
                  }}
                >
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: 0,
                      top: `${whole(-guide.top * scale)}px`,
                      width: `${whole(size.width * scale)}px`,
                      height: `${whole(size.height * scale)}px`,
                    }}
                  >
                    {guide.lines.map((line, index) =>
                      line.axis === 'v' ? (
                        <div
                          key={index}
                          style={{
                            position: 'absolute',
                            left: `${whole(line.at * scale)}px`,
                            top: `${whole(guide.top * scale)}px`,
                            height: `${whole(guide.height * scale)}px`,
                            borderLeft: `1px dashed ${MARGIN_COLOR}`,
                          }}
                        />
                      ) : (
                        <div
                          key={index}
                          style={{
                            position: 'absolute',
                            top: `${whole(line.at * scale)}px`,
                            left: `${whole(MARGIN * scale)}px`,
                            width: `${whole((size.width - MARGIN * 2) * scale)}px`,
                            borderTop: `1px dashed ${MARGIN_COLOR}`,
                          }}
                        />
                      )
                    )}
                  </div>
                </div>
              ))}

              {/* Transparent click targets for inactive sections (no gray overlay) */}
              {activeSection !== 'header' && headerH > 0 ? (
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Click to edit header"
                  onClick={() => onSwitchSection?.('header')}
                  className="absolute cursor-pointer"
                  style={{
                    left: 0,
                    top: 0,
                    width: `${whole(size.width * scale)}px`,
                    height: `${whole(headerH * scale)}px`,
                    zIndex: 12,
                    background: 'transparent',
                  }}
                />
              ) : null}

              {showsContent && activeSection !== 'content' && contentH > 0 ? (
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Click to edit content"
                  onClick={() => onSwitchSection?.('content')}
                  className="absolute cursor-pointer"
                  style={{
                    left: 0,
                    top: `${whole(headerH * scale)}px`,
                    width: `${whole(size.width * scale)}px`,
                    height: `${whole(contentH * scale)}px`,
                    zIndex: 12,
                    background: 'transparent',
                  }}
                />
              ) : null}

              {activeSection !== 'footer' && footerH > 0 ? (
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Click to edit footer"
                  onClick={() => onSwitchSection?.('footer')}
                  className="absolute cursor-pointer"
                  style={{
                    left: 0,
                    top: `${whole((size.height - footerH) * scale)}px`,
                    width: `${whole(size.width * scale)}px`,
                    height: `${whole(footerH * scale)}px`,
                    zIndex: 12,
                    background: 'transparent',
                  }}
                />
              ) : null}

              {/* Interactive Section Height Resize Divider Handle for Header */}
              {onSectionChange && activeSection === 'header' && (
                <div
                  role="separator"
                  aria-label="Resize header height"
                  title="Drag up or down to resize header height"
                  onPointerDown={(e) => startResizeSection(e, 'header')}
                  className="group absolute cursor-row-resize flex items-center justify-center select-none"
                  style={{
                    left: 0,
                    top: `${whole(headerH * scale) - 8}px`,
                    width: `${whole(size.width * scale)}px`,
                    height: '16px',
                    zIndex: 35,
                  }}
                >
                  <div className="w-full h-[2px] bg-blue-400 group-hover:bg-blue-600 transition-colors shadow-xs" />
                  <div className="absolute px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-medium shadow-md flex items-center gap-1.5 pointer-events-none group-hover:scale-105 transition-transform">
                    <span className="text-xs">↕</span>
                    <span>Header: {headerH}px (drag to resize)</span>
                  </div>
                </div>
              )}

              {/* Interactive Section Height Resize Divider Handle for Footer */}
              {onSectionChange && activeSection === 'footer' && (
                <div
                  role="separator"
                  aria-label="Resize footer height"
                  title="Drag up or down to resize footer height"
                  onPointerDown={(e) => startResizeSection(e, 'footer')}
                  className="group absolute cursor-row-resize flex items-center justify-center select-none"
                  style={{
                    left: 0,
                    top: `${whole((size.height - footerH) * scale) - 8}px`,
                    width: `${whole(size.width * scale)}px`,
                    height: '16px',
                    zIndex: 35,
                  }}
                >
                  <div className="w-full h-[2px] bg-blue-400 group-hover:bg-blue-600 transition-colors shadow-xs" />
                  <div className="absolute px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-medium shadow-md flex items-center gap-1.5 pointer-events-none group-hover:scale-105 transition-transform">
                    <span className="text-xs">↕</span>
                    <span>Footer: {footerH}px (drag to resize)</span>
                  </div>
                </div>
              )}

              {sectionBands.map((band) => {
                const frames = ordered.filter((item) => (item.section || 'content') === band.key);
                if (frames.length === 0) return null;
                const top = whole(band.top * scale);
                /* The area being edited keeps a little room under its own bottom edge, so the
                   rotate handle of an item that sits flush with the edge stays reachable. */
                const room = band.key === activeSection ? 44 : 0;
                const isDimmed = activeSection && (activeSection === 'header' || activeSection === 'footer') && band.key !== activeSection;
                return (
                  <div
                    key={band.key}
                    data-editor-clip={band.key}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: `${top}px`,
                      width: '100%',
                      height: `${whole(band.height * scale) + room}px`,
                      overflow: 'hidden',
                      zIndex: band.key === activeSection ? 20 : 10,
                      opacity: isDimmed ? 0.4 : 1,
                      transition: 'opacity 200ms ease-out',
                      pointerEvents: isDimmed ? 'none' : 'auto',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: `${-top}px`,
                        width: '100%',
                        height: `${whole(size.height * scale)}px`,
                        pointerEvents: isDimmed ? 'none' : 'auto',
                      }}
                    >
                      {frames.map((item) => (
                        <ItemFrame
                          key={item.id}
                          item={item}
                          scale={scale}
                          brandKit={brandKit}
                          onOpenBrandKit={onOpenBrandKit}
                          numberInfo={itemNumbers.get(item.id)}
                          selected={selectedIdsList.includes(item.id)}
                          isPrimarySelected={item.id === selectedId}
                          editing={item.id === editingId}
                          hidden={Boolean(hiddenIds?.has?.(item.id))}
                          guidesOn={guidesOn}
                          registerFrame={registerFrame}
                          onSelect={handleItemSelect}
                          onStart={begin}
                          onEdit={onStartEdit}
                          onEditCard={onEditCard}
                          onToggleLock={onToggleLock}
                          onDuplicate={onDuplicate}
                          onDelete={onDelete}
                          onReorder={onReorder}
                          onComment={onComment}
                          isNormalUser={isNormalUser}
                          onFitHeight={(id, h) => actionsRef.current.onFitHeight?.(id, h)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              <div ref={guidesRef} data-editor-guides aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ zIndex: 38 }} />

              {editingId && editingItem ? (
                <ItemTextEditor
                  item={editingItem}
                  scale={scale}
                  brandKit={brandKit}
                  onCommit={(text) => {
                    actionsRef.current.onCommitText?.(editingItem.id, text);
                    onStopEdit?.();
                  }}
                  onCancel={onStopEdit}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
