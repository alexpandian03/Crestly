import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Image as ImageIcon, Lock } from 'lucide-react';
import PosterCanvas from '../PosterCanvas';
import { resolvePosterBrand } from '../../utils/brandRender';
import { resolveTemplateRender } from '../../utils/templateRender';
import {
  areaName,
  areaOf,
  areasOverlap,
  constrainArea,
  GRID_STEP,
  isEditableType,
} from '../../utils/templateBuilderRules';

/**
 * The editing canvas: the real poster (your brand kit + these areas + sample words)
 * with an overlay on top for selecting, moving and resizing the two editable areas.
 *
 * The poster is a full-size DOM layer shrunk with `transform: scale()`. The overlay is a
 * SIBLING of that scaled layer, not a child, and every box in it is placed in screen
 * pixels (poster px x scale). Handles are therefore always 10 px on screen, at any zoom.
 */

const ZOOM_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: '0.5', label: '50%' },
  { value: '1', label: '100%' },
];

/** Room kept around the poster when "Fit" works out how small to draw it. */
const FIT_PADDING = 16;

const HANDLE_SIZE = 10;
const HANDLE_HALF = HANDLE_SIZE / 2;
const HANDLE_BLUE = '#2563EB';

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
}) {
  const boxRef = useRef(null);
  const gesture = useRef(null);
  const frozen = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState('fit');
  const [guidesOn, setGuidesOn] = useState(true);
  const [gesturing, setGesturing] = useState(false);

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

  const imageZone = areaOf(zones, 'image');
  const overlap = Boolean(imageZone) && areasOverlap(areaOf(zones, 'content'), imageZone);

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

  const moveGesture = (event) => {
    const run = gesture.current;
    if (!run) return;
    event.preventDefault();
    const dx = (event.clientX - run.x0) / scale;
    const dy = (event.clientY - run.y0) / scale;
    const { x, y, w, h } = run.rect;
    const next = run.dir
      ? {
          x: run.dir.includes('w') ? x + dx : x,
          y: run.dir.includes('n') ? y + dy : y,
          w: run.dir.includes('e') ? w + dx : run.dir.includes('w') ? w - dx : w,
          h: run.dir.includes('s') ? h + dy : run.dir.includes('n') ? h - dy : h,
        }
      : { x: x + dx, y: y + dy, w, h };
    /* Snaps to the grid, keeps the area inside the poster and clear of both brand areas. */
    const grid = event.shiftKey ? GRID_STEP * 5 : GRID_STEP;
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

  const preview = gesturing && frozen.current ? frozen.current : { template, content };
  const posterW = size.width * scale;
  const posterH = size.height * scale;
  const selected = zones.find((zone) => zone.id === selectedId) || null;
  const selectedEditable = Boolean(selected && isEditableType(selected.type) && !selected.locked);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-heading">Poster areas</h2>
          <p className="text-xs text-muted">
            Drag the {areaName('content').toLowerCase()} and the {areaName('image').toLowerCase()}. The two brand
            areas come from your brand kit and stay put.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        aria-label={`Poster areas at ${size.width} by ${size.height} pixels, shown at ${Math.round(scale * 100)} percent`}
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
                  className="absolute left-0 top-0"
                  style={{
                    width: size.width,
                    height: size.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <PosterCanvas brandKit={brandKit} template={preview.template} content={preview.content} />
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
              <div className="absolute inset-0" onPointerDown={() => onSelect(null)}>
                {zones.map((zone) => {
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
              </div>

              {/* One floating tag, above the selected area only. */}
              {guidesOn && selectedEditable ? (
                <span
                  className="pointer-events-none absolute inline-flex max-w-[calc(100%-8px)] items-center truncate rounded-[5px] bg-heading/85 px-1.5 py-0.5 text-[11px] font-semibold text-canvas"
                  style={{
                    left: Math.max(2, Math.min(selected.x * scale, posterW - 132)),
                    top: Math.max(0, selected.y * scale - 24),
                    zIndex: 4,
                  }}
                >
                  {areaName(selected.type)} · {selected.w} × {selected.h}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2">
        {overlap ? (
          <p className="flex items-start gap-1.5 rounded-card border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>
              The {areaName('content').toLowerCase()} and the {areaName('image').toLowerCase()} overlap. The words
              will sit on top of the photo. Move one of them apart.
            </span>
          </p>
        ) : null}
        <p className="text-xs text-muted">
          Positions and sizes are in poster pixels, measured from the top left. Everything moves in {GRID_STEP}{' '}
          pixel steps, or {GRID_STEP * 5} with Shift held, and an area cannot be dragged onto a brand area or
          outside the poster.
        </p>
      </div>
    </div>
  );
}
