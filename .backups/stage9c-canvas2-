import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import { AlertTriangle, Image as ImageIcon, Lock } from 'lucide-react';
import PosterCanvas from '../PosterCanvas';
import { alpha, resolvePosterBrand } from '../../utils/brandRender';
import { resolveTemplateRender } from '../../utils/templateRender';
import {
  areaName,
  areaOf,
  areasOverlap,
  constrainArea,
  GRID_STEP,
  isEditableType,
  MIN_AREA_SIZE,
} from '../../utils/templateBuilderRules';

/**
 * The editing canvas: the real poster (your brand kit + these areas + sample words)
 * with a transparent Konva layer on top for moving and resizing the two editable areas.
 *
 * The poster is a full-size DOM layer scaled with a CSS transform; the Konva stage uses
 * the same scale, so both layers line up and every stored number stays a poster pixel.
 * Line widths, anchors and the Transformer are divided by the scale to keep one size on screen.
 */

const ZOOM_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: '0.5', label: '50%' },
  { value: '1', label: '100%' },
];

const ZOOM_INK = { selected: 0.14, plain: 0.08 };

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
  const trRef = useRef(null);
  const nodeRefs = useRef({});
  const frozen = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState('fit');
  const [gesturing, setGesturing] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const read = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (el) setBox({ width: el.clientWidth, height: el.clientHeight });
  }, [size.width, size.height]);

  const fitScale =
    box.width > 0 && box.height > 0
      ? Math.min(1, box.width / size.width, box.height / size.height)
      : 0;
  const scale = zoom === 'fit' ? fitScale : Number(zoom);
  const ui = (px) => (scale > 0 ? px / scale : px);
  const dash = (values) => values.map(ui);

  const brand = useMemo(() => resolvePosterBrand(brandKit, { size, zones: [] }), [brandKit, size]);
  const rendered = useMemo(() => resolveTemplateRender(template), [template]);

  const photoUrl =
    String(content?.imageUrl || content?.image || '').trim() || String(brand.content.defaultImageUrl || '').trim();
  /* Sample words never carry a photo, so the declared photo area shows a placeholder instead. */
  const showPlaceholder = Boolean(rendered.zones.image) && !rendered.layout.hidePhoto && !photoUrl;

  const imageZone = areaOf(zones, 'image');
  const overlap = Boolean(imageZone) && areasOverlap(areaOf(zones, 'content'), imageZone);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const zone = (zones || []).find((item) => item.id === selectedId);
    const node = zone && isEditableType(zone.type) && !zone.locked ? nodeRefs.current[zone.id] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, zones, scale]);

  const stepFor = (event) => (event?.evt?.shiftKey ? GRID_STEP * 5 : GRID_STEP);

  const startGesture = () => {
    frozen.current = { template, content };
    setGesturing(true);
    onBegin();
  };

  const endGesture = () => {
    frozen.current = null;
    setGesturing(false);
    onEnd();
  };

  const handleDragMove = (zone) => (event) => {
    const node = event.target;
    const fixed = constrainArea(
      { x: node.x(), y: node.y(), w: zone.w, h: zone.h },
      { size, zones, grid: stepFor(event) }
    );
    if (node.x() !== fixed.x || node.y() !== fixed.y) node.position({ x: fixed.x, y: fixed.y });
    onLiveChange(zone.id, fixed);
  };

  const handleTransform = (zone) => (event) => {
    const node = event.target;
    const fixed = constrainArea(
      { x: node.x(), y: node.y(), w: node.width(), h: node.height() },
      { size, zones, grid: stepFor(event) }
    );
    node.setAttrs({ x: fixed.x, y: fixed.y, width: fixed.w, height: fixed.h });
    onLiveChange(zone.id, fixed);
  };

  const handleEnd = (zone) => (event) => {
    const node = event.target;
    const fixed = constrainArea(
      { x: node.x(), y: node.y(), w: node.width(), h: node.height() },
      { size, zones, grid: stepFor(event) }
    );
    node.setAttrs({ x: fixed.x, y: fixed.y, width: fixed.w, height: fixed.h });
    onLiveChange(zone.id, fixed);
    endGesture();
  };

  const deselectOnBackground = (event) => {
    const stage = event.target.getStage();
    if (event.target === stage || event.target.name() === 'plate') onSelect(null);
  };

  const preview = gesturing && frozen.current ? frozen.current : { template, content };
  const posterW = Math.round(size.width * scale);
  const posterH = Math.round(size.height * scale);

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
        <ZoomPicker value={zoom} fitScale={fitScale} onChange={setZoom} />
      </div>

      <div
        ref={boxRef}
        className="min-h-0 flex-1 overflow-auto rounded-card border border-line bg-preview"
        role="group"
        aria-label={`Poster areas at ${size.width} by ${size.height} pixels, shown at ${Math.round(scale * 100)} percent`}
      >
        {scale > 0 ? (
          <div
            className="relative mx-auto overflow-hidden shadow-soft"
            style={{ width: posterW, height: posterH }}
          >
            {/* The live poster, at full poster pixels and scaled down to fit. */}
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

            {/* The handles, in the same scaled box. */}
            <div className="absolute left-0 top-0">
              <Stage
                width={posterW}
                height={posterH}
                scaleX={scale}
                scaleY={scale}
                onMouseDown={deselectOnBackground}
                onTouchStart={deselectOnBackground}
              >
                <Layer>
                  <Rect name="plate" width={size.width} height={size.height} fill="rgba(255, 255, 255, 0)" />

                  {zones.map((zone) => {
                    const editable = isEditableType(zone.type) && !zone.locked;
                    const selected = selectedId === zone.id;
                    const band = zone.type === 'header' || zone.type === 'footer';
                    const lineColor = band
                      ? 'rgba(15, 23, 42, 0.55)'
                      : zone.type === 'image'
                        ? '#475569'
                        : brand.primary;

                    return (
                      <Rect
                        key={zone.id}
                        name={zone.type}
                        ref={(node) => {
                          if (node) nodeRefs.current[zone.id] = node;
                          else delete nodeRefs.current[zone.id];
                        }}
                        x={zone.x}
                        y={zone.y}
                        width={zone.w}
                        height={zone.h}
                        fill={
                          band
                            ? 'rgba(15, 23, 42, 0.05)'
                            : alpha(selected ? brand.primary : lineColor, selected ? ZOOM_INK.selected : ZOOM_INK.plain)
                        }
                        stroke={lineColor}
                        strokeEnabled
                        dash={band || !selected ? dash([8, 6]) : undefined}
                        strokeWidth={ui(selected ? 2.5 : 1.5)}
                        cornerRadius={ui(3)}
                        draggable={editable}
                        onDragStart={editable ? startGesture : undefined}
                        onDragMove={editable ? handleDragMove(zone) : undefined}
                        onDragEnd={editable ? handleEnd(zone) : undefined}
                        onTransformStart={editable ? startGesture : undefined}
                        onTransform={editable ? handleTransform(zone) : undefined}
                        onTransformEnd={editable ? handleEnd(zone) : undefined}
                        onMouseDown={() => onSelect(zone.id)}
                        onTouchStart={() => onSelect(zone.id)}
                      />
                    );
                  })}

                  <Transformer
                    ref={trRef}
                    rotateEnabled={false}
                    flipEnabled={false}
                    keepRatio={false}
                    centeredScaling={false}
                    ignoreStroke
                    anchorSize={ui(11)}
                    anchorCornerRadius={ui(2)}
                    anchorStroke={brand.primary}
                    anchorFill="#ffffff"
                    anchorStrokeWidth={ui(1.4)}
                    borderStroke={brand.primary}
                    borderStrokeWidth={ui(1.2)}
                    boundBoxFunc={(oldBox, newBox) =>
                      newBox.width < MIN_AREA_SIZE.width * scale || newBox.height < MIN_AREA_SIZE.height * scale
                        ? oldBox
                        : newBox
                    }
                  />
                </Layer>
              </Stage>
            </div>

            {/* Names sit in the scaled box but keep one readable size on screen. */}
            <div className="pointer-events-none absolute inset-0">
              {zones.map((zone) => {
                const band = zone.type === 'header' || zone.type === 'footer';
                return (
                  <span
                    key={zone.id}
                    className="absolute inline-flex max-w-[calc(100%-12px)] items-center gap-1 truncate rounded-[5px] bg-heading/85 px-1.5 py-0.5 text-[11px] font-semibold text-canvas"
                    style={{ left: Math.round(zone.x * scale) + 5, top: Math.round(zone.y * scale) + 5 }}
                  >
                    {band ? <Lock className="h-3 w-3 shrink-0" /> : null}
                    <span className="truncate">
                      {band ? 'Locked brand area' : `${areaName(zone.type)} · ${zone.w} × ${zone.h}`}
                    </span>
                  </span>
                );
              })}
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
