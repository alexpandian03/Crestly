import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Image as ImageIcon, Lock } from 'lucide-react';
import PosterCanvas from '../PosterCanvas';
import { resolvePosterBrand } from '../../utils/brandRender';
import { resolveTemplateRender } from '../../utils/templateRender';
import {
  areaName,
  constrainArea,
  constrainItemOffset,
  GRID_STEP,
  ITEM_KEYS,
  ITEM_NAMES,
  isEditableType,
  itemRoom,
} from '../../utils/templateBuilderRules';

/**
 * The editing canvas: the real poster (your brand kit + these areas + sample words)
 * with an overlay on top for selecting, moving and resizing the two editable areas.
 *
 * The poster is a full-size DOM layer shrunk with `transform: scale()`. The overlay is a
 * SIBLING of that scaled layer, not a child, and every box in it is placed in screen
 * pixels (poster px x scale). Handles are therefore always 10 px on screen, at any zoom.
 *
 * In "Items" mode the same overlay carries one frame per word group (headline,
 * the line under it, date, time, place, extra lines). Those frames come from the painted
 * poster: each group is measured through its data-item marker, so what you grab is what
 * the poster really shows. Their position on screen is where they sit plus their nudge.
 */

const ZOOM_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: '0.5', label: '50%' },
  { value: '1', label: '100%' },
];

/** What the overlay grabs: whole areas, or one item of words at a time. */
const MODE_OPTIONS = [
  { value: 'areas', label: 'Areas' },
  { value: 'items', label: 'Items' },
];

/** Room kept around the poster when "Fit" works out how small to draw it. */
const FIT_PADDING = 16;

const HANDLE_SIZE = 10;
const HANDLE_HALF = HANDLE_SIZE / 2;
const HANDLE_BLUE = '#2563EB';
const ITEM_LINE = '#0f766e';

const CORNER_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
};
/** Where each handle sits inside its area's frame, in percentages of that frame. */
const HANDLE_SPOTS = {
  nw: { left: 0, top: 0 },
  n: { left: 50, top: 0 },
  ne: { left: 100, top: 0 },
  e: { left: 100, top: 50 },
  se: { left: 100, top: 100 },
  s: { left: 50, top: 100 },
  sw: { left: 0, top: 100 },
  w: { left: 0, top: 50 },
};

function handleStyle(dir) {
  const spot = HANDLE_SPOTS[dir];
  return {
    position: 'absolute',
    left: `calc(${spot.left}% - ${HANDLE_HALF}px)`,
    top: `calc(${spot.top}% - ${HANDLE_HALF}px)`,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    boxSizing: 'border-box',
    background: '#ffffff',
    border: `1.5px solid ${HANDLE_BLUE}`,
    borderRadius: 2,
    cursor: CURSORS[dir],
    touchAction: 'none',
    zIndex: 3,
  };
}

/** A nudge, said in the words a person would use out loud. */
function offsetWords(offset) {
  if (!offset) return '';
  const parts = [];
  if (offset.dx > 0) parts.push(`${offset.dx} px right`);
  if (offset.dx < 0) parts.push(`${-offset.dx} px left`);
  if (offset.dy > 0) parts.push(`${offset.dy} px down`);
  if (offset.dy < 0) parts.push(`${-offset.dy} px up`);
  return parts.length > 0 ? parts.join(', ') : 'as it comes';
}

/** Where two rectangles agree, or null when they miss each other completely. */
function intersectRect(a, b) {
  if (!a || !b) return null;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) return null;
  return { x, y, w: right - x, h: bottom - y };
}

/** Word groups only move when their measured place moves, so re-measuring is cheap. */
function sameRects(a, b) {
  const keys = Object.keys(b);
  if (Object.keys(a).length !== keys.length) return false;
  return keys.every((key) => {
    const left = a[key];
    const right = b[key];
    return (
      left &&
      right &&
      Math.round(left.x) === Math.round(right.x) &&
      Math.round(left.y) === Math.round(right.y) &&
      Math.round(left.w) === Math.round(right.w) &&
      Math.round(left.h) === Math.round(right.h)
    );
  });
}

function ModePicker({ value, onChange }) {
  return (
    <div className="flex gap-1 rounded-chip border border-line bg-section p-1" role="group" aria-label="What to move">
      {MODE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`rounded-[6px] px-2.5 py-1 text-xs font-semibold transition-colors ${
              active ? 'bg-primary text-white shadow-soft' : 'text-body hover:bg-canvas hover:text-heading'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ZoomPicker({ value, fitScale, onChange }) {
  const percent = Math.round((value === 'fit' ? fitScale : Number(value)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 rounded-chip border border-line bg-section p-1" role="group" aria-label="Zoom">
        {ZOOM_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`rounded-[6px] px-2.5 py-1 text-xs font-semibold transition-colors ${
                active ? 'bg-primary text-white shadow-soft' : 'text-body hover:bg-canvas hover:text-heading'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <span className="w-10 shrink-0 text-xs tabular-nums text-muted">{percent}%</span>
    </div>
  );
}

export default function AreaStage({
  size,
  zones,
  brandKit,
  template,
  content,
  selectedId,
  onSelect,
  onLiveChange,
  onBegin,
  onEnd,
  stageMode = 'areas',
  onSelectMode,
  selectedItem = '',
  onSelectItem,
  onItemLiveChange,
  onItemGeometry,
}) {
  const boxRef = useRef(null);
  const layerRef = useRef(null);
  const gesture = useRef(null);
  const frozen = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState('fit');
  const [guidesOn, setGuidesOn] = useState(true);
  const [gesturing, setGesturing] = useState(false);
  /** Where each word group sits with no nudge, in poster pixels. */
  const [itemRects, setItemRects] = useState({});
  const [settleTick, setSettleTick] = useState(0);

  /* The poster picks its own text size after the fonts and the photo land, which moves
     every word group, so the frames are measured again each time it settles. */
  const onSettled = useCallback(() => setSettleTick((tick) => tick + 1), []);

  const read = () => {
    const el = boxRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    /* Only a real change re-renders, so the effect below can run after every render. */
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    window.addEventListener('resize', read);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);

  useEffect(() => {
    read();
  }, [size.width, size.height]);

  /* The note under the canvas and the zoom row can both change this box's height without
     the window resizing, so the measured size is checked after every render too. */
  useEffect(read);

  const fitScale =
    box.width > 0 && box.height > 0
      ? Math.min(
          1,
          (box.width - FIT_PADDING * 2) / size.width,
          (box.height - FIT_PADDING * 2) / size.height
        )
      : 0;
  const scale = zoom === 'fit' ? Math.max(fitScale, 0) : Number(zoom);

  const brand = useMemo(() => resolvePosterBrand(brandKit, { size, zones: [] }), [brandKit, size]);
  const rendered = useMemo(() => resolveTemplateRender(template), [template]);

  const photoUrl =
    String(content?.imageUrl || content?.image || '').trim() || String(brand.content.defaultImageUrl || '').trim();
  /* Sample words never carry a photo, so the declared photo area shows a placeholder instead. */
  const showPlaceholder = Boolean(rendered.zones.image) && !rendered.layout.hidePhoto && !photoUrl;

  /* While a gesture runs the painted poster is held at the state it started from, so the
     text does not re-fit on every frame and the frames can keep moving on their own. */
  const preview = gesturing && frozen.current ? frozen.current : { template, content };
  const offsets = rendered.layout.itemOffsets;

  /* The words can only be pushed into the part of the text area the poster really shows:
     the declared area, clipped by whatever the brand bands already took. */
  const painted = useMemo(() => resolvePosterBrand(brandKit, preview.template), [brandKit, preview.template]);
  const itemArea = useMemo(() => {
    const panel = { x: painted.content.x, y: painted.content.y, w: painted.content.w, h: painted.content.h };
    return intersectRect(rendered.zones.content, panel) || rendered.zones.content;
  }, [painted, rendered]);

  const measureItems = useCallback(() => {
    const layer = layerRef.current;
    if (!layer || !(scale > 0)) return;
    const frame = layer.getBoundingClientRect();
    /* A painted shift is not a re-layout, so the marker's own box already carries it. */
    const found = {};
    for (const key of ITEM_KEYS) {
      const el = layer.querySelector(`[data-item="${key}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const shift = offsets[key];
      found[key] = {
        x: (rect.left - frame.left) / scale - shift.dx,
        y: (rect.top - frame.top) / scale - shift.dy,
        w: rect.width / scale,
        h: rect.height / scale,
      };
    }
    setItemRects((prev) => (sameRects(prev, found) ? prev : found));
  }, [scale, offsets]);

  /* Never mid-gesture: the layer is showing the frozen state then, so a reading would
     subtract the wrong shift. The gesture ending re-runs this and the poster settling
     (fonts, photo, a new text size) does too. */
  useEffect(() => {
    if (gesturing) return;
    measureItems();
  }, [gesturing, measureItems, settleTick, stageMode]);

  /** How far each group may still travel from where the layout put it. */
  const rooms = useMemo(() => {
    const next = {};
    for (const key of ITEM_KEYS) {
      if (itemRects[key]) next[key] = itemRoom(itemRects[key], itemArea);
    }
    return next;
  }, [itemRects, itemArea]);

  const reportedRef = useRef('');
  useEffect(() => {
    const signature = JSON.stringify(rooms);
    if (signature === reportedRef.current) return;
    reportedRef.current = signature;
    onItemGeometry?.(rooms);
  }, [rooms, onItemGeometry]);

  const itemFrame = (key) => {
    const base = itemRects[key];
    if (!base) return null;
    const shift = offsets[key];
    return { x: base.x + shift.dx, y: base.y + shift.dy, w: base.w, h: base.h };
  };

  /* ------------------------------------------------------ gestures */
  const startGesture = (zone, dir) => (event) => {
    event.stopPropagation();
    onSelect(zone.id);
    if (event.button != null && event.button !== 0) return;
    if (!isEditableType(zone.type) || zone.locked) return;
    event.preventDefault();
    /* Can throw once the pointer is already released; the drag still works without it. */
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    gesture.current = {
      zoneId: zone.id,
      dir,
      x0: event.clientX,
      y0: event.clientY,
      rect: { x: zone.x, y: zone.y, w: zone.w, h: zone.h },
    };
    frozen.current = { template, content };
    setGesturing(true);
    onBegin();
  };

  const startItemGesture = (key) => (event) => {
    event.stopPropagation();
    onSelectItem(key);
    const base = itemRects[key];
    const room = rooms[key];
    if (!base || !room || (event.button != null && event.button !== 0)) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    gesture.current = {
      kind: 'item',
      itemKey: key,
      x0: event.clientX,
      y0: event.clientY,
      offset: { ...offsets[key] },
      room,
    };
    frozen.current = { template, content };
    setGesturing(true);
    onBegin();
  };

  const moveGesture = (event) => {
    const run = gesture.current;
    if (!run) return;
    event.preventDefault();
    const dx = (event.clientX - run.x0) / scale;
    const dy = (event.clientY - run.y0) / scale;
    /* Snaps to the grid, keeps the area inside the poster and clear of both brand areas. */
    const grid = event.shiftKey ? GRID_STEP * 5 : GRID_STEP;

    if (run.kind === 'item') {
      /* A word group only moves: it stays inside the text area, and nothing resizes. */
      onItemLiveChange(run.itemKey, constrainItemOffset({ dx: run.offset.dx + dx, dy: run.offset.dy + dy }, run.room, grid));
      return;
    }

    const { x, y, w, h } = run.rect;
    const next = run.dir
      ? {
          x: run.dir.includes('w') ? x + dx : x,
          y: run.dir.includes('n') ? y + dy : y,
          w: run.dir.includes('e') ? w + dx : run.dir.includes('w') ? w - dx : w,
          h: run.dir.includes('s') ? h + dy : run.dir.includes('n') ? h - dy : h,
        }
      : { x: x + dx, y: y + dy, w, h };
    const fixed = constrainArea(next, { size, zones, grid });
    /* Moving only changes where an area lands: its size stays exactly as it is. */
    onLiveChange(run.zoneId, run.dir ? fixed : { ...fixed, w: run.rect.w, h: run.rect.h });
  };

  const endGesture = () => {
    if (!gesture.current) return;
    gesture.current = null;
    frozen.current = null;
    setGesturing(false);
    onEnd();
  };

  const stopAndMove = (event) => {
    event.stopPropagation();
    moveGesture(event);
  };

  const stopAndEnd = (event) => {
    event.stopPropagation();
    endGesture();
  };

  /* An empty part of the poster lets go of what is selected in the current mode. */
  const overlayDown = () => {
    if (stageMode === 'items') onSelectItem('');
    else onSelect(null);
  };

  const posterW = size.width * scale;
  const posterH = size.height * scale;
  const selected = zones.find((zone) => zone.id === selectedId) || null;
  const selectedEditable = Boolean(selected && isEditableType(selected.type) && !selected.locked);
  const itemsMode = stageMode === 'items';
  const tagRect = itemsMode
    ? selectedItem
      ? itemFrame(selectedItem)
      : null
    : selectedEditable
      ? { x: selected.x, y: selected.y }
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-heading">
            {itemsMode ? 'Move one item' : 'Poster areas'}
          </h2>
          <p className="text-xs text-muted">
            {itemsMode
              ? 'Click an item on the poster, then drag it or use the arrow keys. It cannot leave the text area.'
              : `Drag the ${areaName('content').toLowerCase()} and the ${areaName(
                  'image'
                ).toLowerCase()}. The two brand areas come from your brand kit and stay put.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModePicker value={stageMode} onChange={onSelectMode} />
          <button
            type="button"
            onClick={() => setGuidesOn((on) => !on)}
            aria-pressed={!guidesOn}
            className={`btn-ghost border inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold ${
              guidesOn ? 'border-line' : 'border-primary text-primary'
            }`}
          >
            {guidesOn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {guidesOn ? 'Hide guides' : 'Show guides'}
          </button>
          <ZoomPicker value={zoom} fitScale={fitScale} onChange={setZoom} />
        </div>
      </div>

      <div
        ref={boxRef}
        className="min-h-0 flex-1 overflow-auto rounded-card border border-line bg-preview"
        role="group"
        aria-label={`Poster at ${size.width} by ${size.height} pixels, shown at ${Math.round(scale * 100)} percent`}
      >
        {scale > 0 ? (
          <div
            className="flex min-h-full w-full"
            style={{ padding: FIT_PADDING, boxSizing: 'border-box' }}
          >
            {/* The scaled poster, the overlay on top of it, and the selected label. */}
            <div
              className="relative shrink-0"
              style={{ width: posterW, height: posterH, margin: 'auto' }}
            >
              {/* Clipping lives here so the pre-transform poster cannot stretch the scroll
                  area, while the handles above it may stick out by a few pixels. */}
              <div className="absolute inset-0 overflow-hidden shadow-soft">
                <div
                  ref={layerRef}
                  className="absolute left-0 top-0"
                  style={{
                    width: size.width,
                    height: size.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <PosterCanvas
                    brandKit={brandKit}
                    template={preview.template}
                    content={preview.content}
                    onLayoutSettled={onSettled}
                  />
                  {showPlaceholder ? (
                    <div
                      className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-slate-400 bg-slate-100 text-slate-500"
                      style={{
                        position: 'absolute',
                        left: `${rendered.zones.image.x}px`,
                        top: `${rendered.zones.image.y}px`,
                        width: `${rendered.zones.image.w}px`,
                        height: `${rendered.zones.image.h}px`,
                        zIndex: 60,
                      }}
                    >
                      <ImageIcon style={{ width: 56, height: 56 }} />
                      <span style={{ fontSize: 30, fontWeight: 600 }}>Photo goes here</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Screen-coordinate overlay. A child of the poster box, never of the scaled layer. */}
              <div className="absolute inset-0" onPointerDown={overlayDown}>
                {!itemsMode &&
                  zones.map((zone) => {
                  const band = !isEditableType(zone.type);
                  const isSelected = selectedId === zone.id;
                  const movable = !band && !zone.locked;
                  const lineColor = zone.type === 'image' ? '#475569' : brand.primary || HANDLE_BLUE;
                  /* Guides off keeps the invisible hit areas so dragging still works.
                     Brand areas show a lock icon only, never an outline. */
                  const border = !guidesOn
                    ? '1px solid transparent'
                    : isSelected
                      ? `1.5px solid ${HANDLE_BLUE}`
                      : band
                        ? '1px solid transparent'
                        : `1px dashed ${lineColor}`;

                  return (
                    <div
                      key={zone.id}
                      onPointerDown={startGesture(zone, null)}
                      onPointerMove={moveGesture}
                      onPointerUp={endGesture}
                      onPointerCancel={endGesture}
                      style={{
                        position: 'absolute',
                        left: zone.x * scale,
                        top: zone.y * scale,
                        width: zone.w * scale,
                        height: zone.h * scale,
                        boxSizing: 'border-box',
                        border,
                        background: 'transparent',
                        cursor: guidesOn && movable ? 'move' : 'default',
                        touchAction: 'none',
                        zIndex: isSelected ? 2 : 1,
                      }}
                    >
                      {guidesOn && (band || zone.locked) ? (
                        <span
                          title={band ? 'Locked brand area' : 'Kept fixed'}
                          className="absolute flex h-5 w-5 items-center justify-center rounded-[5px] bg-heading/85 text-canvas"
                          style={{ left: 5, top: 5 }}
                        >
                          <Lock className="h-3 w-3" />
                        </span>
                      ) : null}

                      {guidesOn && isSelected && movable
                        ? CORNER_DIRS.map((dir) => (
                            <span
                              key={dir}
                              onPointerDown={startGesture(zone, dir)}
                              onPointerMove={stopAndMove}
                              onPointerUp={stopAndEnd}
                              onPointerCancel={stopAndEnd}
                              style={handleStyle(dir)}
                            />
                          ))
                        : null}
                    </div>
                  );
                })}

                {itemsMode
                  ? [
                      /* The edge of the room the words may use, so the limit is visible. */
                      <div
                        key="__area"
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: itemArea.x * scale,
                          top: itemArea.y * scale,
                          width: itemArea.w * scale,
                          height: itemArea.h * scale,
                          boxSizing: 'border-box',
                          border: guidesOn ? `1px dashed ${ITEM_LINE}` : '1px solid transparent',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      />,
                      ...ITEM_KEYS.map((key) => {
                        const frame = itemFrame(key);
                        if (!frame) return null;
                        const isOn = selectedItem === key;
                        return (
                          <div
                            key={key}
                            aria-label={`${ITEM_NAMES[key]}, ${offsetWords(offsets[key])}`}
                            onPointerDown={startItemGesture(key)}
                            onPointerMove={stopAndMove}
                            onPointerUp={stopAndEnd}
                            onPointerCancel={stopAndEnd}
                            style={{
                              position: 'absolute',
                              left: frame.x * scale,
                              top: frame.y * scale,
                              width: frame.w * scale,
                              height: frame.h * scale,
                              boxSizing: 'border-box',
                              border: !guidesOn
                                ? '1px solid transparent'
                                : isOn
                                  ? `1.5px solid ${HANDLE_BLUE}`
                                  : `1px dashed ${ITEM_LINE}`,
                              background: 'transparent',
                              cursor: 'move',
                              touchAction: 'none',
                              zIndex: isOn ? 3 : 2,
                            }}
                          />
                        );
                      }),
                    ]
                  : null}
              </div>

              {/* One floating tag, above what is selected. */}
              {guidesOn && tagRect ? (
                <span
                  className="pointer-events-none absolute inline-flex max-w-[calc(100%-8px)] items-center truncate rounded-[5px] bg-heading/85 px-1.5 py-0.5 text-[11px] font-semibold text-canvas"
                  style={{
                    left: Math.max(2, Math.min(tagRect.x * scale, posterW - 132)),
                    top: Math.max(0, tagRect.y * scale - 24),
                    zIndex: 4,
                  }}
                >
                  {itemsMode
                    ? `${ITEM_NAMES[selectedItem]} · ${offsetWords(offsets[selectedItem])}`
                    : `${areaName(selected.type)} · ${selected.w} × ${selected.h}`}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2">
        <p className="text-xs text-muted">
          {itemsMode
            ? `The layout settings decide where each item starts; a move here only nudges it from that place. Items move in ${GRID_STEP} pixel steps, or ${GRID_STEP * 5} with Shift held, and cannot leave the ${areaName(
                'content'
              ).toLowerCase()}.`
            : `Positions and sizes are in poster pixels, measured from the top left. Everything moves in ${GRID_STEP} pixel steps, or ${GRID_STEP * 5} with Shift held, and an area cannot be dragged onto a brand area or outside the poster.`}
        </p>
      </div>
    </div>
  );
}
