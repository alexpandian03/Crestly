import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Arc, Group, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import { pickReadableColor } from '../../utils/contrast';
import { resolvePosterBrand } from '../../utils/brandRender';
import {
  areaName,
  constrainArea,
  GRID_STEP,
  isEditableType,
  MIN_AREA_SIZE,
} from '../../utils/templateBuilderRules';

/**
 * The editing canvas: the poster drawn as blocks at real poster pixels, with the two
 * brand areas fixed and the text and photo areas draggable and resizable.
 *
 * The Stage is scaled to the space available while every stored number stays a poster
 * pixel value, so line widths, anchors and labels are divided by the scale to keep a
 * constant size on screen.
 */

const BAND_OPACITY = 0.45;
const LABEL_COLORS = ['#ffffff', '#0b0f17'];

function LockMark({ x, y, size, color }) {
  const body = size * 0.62;
  return (
    <Group x={x} y={y} listening={false}>
      <Rect y={body * 0.55} width={size} height={body} cornerRadius={size * 0.14} fill={color} />
      <Arc
        x={size / 2}
        y={body * 0.62}
        innerRadius={size * 0.2}
        outerRadius={size * 0.38}
        angle={180}
        rotation={180}
        stroke={color}
        strokeWidth={Math.max(1, size * 0.13)}
        fillEnabled={false}
      />
    </Group>
  );
}

export default function AreaStage({
  size,
  zones,
  brandKit,
  selectedId,
  onSelect,
  onLiveChange,
  onBegin,
  onEnd,
}) {
  const wrapRef = useRef(null);
  const trRef = useRef(null);
  const nodeRefs = useRef({});
  const [avail, setAvail] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setAvail(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (wrapRef.current) setAvail(wrapRef.current.clientWidth);
  }, [size.width]);

  const scale = avail > 0 ? Math.min(1, avail / size.width) : 0;
  const ui = (px) => (scale > 0 ? px / scale : px);
  const dash = (values) => values.map((value) => ui(value));

  const brand = useMemo(() => resolvePosterBrand(brandKit, { size, zones: [] }), [brandKit, size]);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, zones, scale]);

  const handleDragMove = (zone) => (event) => {
    const node = event.target;
    const fixed = constrainArea({ x: node.x(), y: node.y(), w: zone.w, h: zone.h }, { size, zones });
    if (node.x() !== fixed.x || node.y() !== fixed.y) node.position({ x: fixed.x, y: fixed.y });
    onLiveChange(zone.id, fixed);
  };

  const handleTransform = (zone) => (event) => {
    const node = event.target;
    const fixed = constrainArea(
      { x: node.x(), y: node.y(), w: node.width(), h: node.height() },
      { size, zones }
    );
    node.setAttrs({ x: fixed.x, y: fixed.y, width: fixed.w, height: fixed.h });
    onLiveChange(zone.id, fixed);
  };

  const handleEnd = (zone) => (event) => {
    const node = event.target;
    const fixed = constrainArea(
      { x: node.x(), y: node.y(), w: node.width(), h: node.height() },
      { size, zones }
    );
    node.setAttrs({ x: fixed.x, y: fixed.y, width: fixed.w, height: fixed.h });
    onLiveChange(zone.id, fixed);
    onEnd();
  };

  const deselectOnBackground = (event) => {
    const stage = event.target.getStage();
    if (event.target === stage || event.target.name() === 'plate') onSelect(null);
  };

  return (
    <div ref={wrapRef} className="w-full">
      <div
        className="relative flex w-full justify-center"
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
        role="group"
        aria-label={`Poster areas at ${size.width} by ${size.height} pixels. Use the area buttons and the position fields to change the layout.`}
      >
        {scale > 0 ? (
          <Stage
            width={Math.round(size.width * scale)}
            height={Math.round(size.height * scale)}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={deselectOnBackground}
            onTouchStart={deselectOnBackground}
          >
            <Layer>
              <Rect
                name="plate"
                width={size.width}
                height={size.height}
                fill={brand.canvas.color}
                stroke={brand.primary}
                strokeWidth={ui(1)}
              />

              {zones.map((zone) => {
                const editable = isEditableType(zone.type) && !zone.locked;
                const selected = selectedId === zone.id;
                const band = zone.type === 'header' || zone.type === 'footer';
                const surface = band
                  ? zone.type === 'header'
                    ? brand.header.surface
                    : brand.footer.surface
                  : brand.canvas.color;
                const ink = pickReadableColor(LABEL_COLORS, surface, 3.5) || LABEL_COLORS[0];
                const lineColor = band ? ink : zone.type === 'image' ? '#475569' : brand.primary;

                return (
                  <React.Fragment key={zone.id}>
                    <Rect
                      ref={(node) => {
                        if (node) nodeRefs.current[zone.id] = node;
                        else delete nodeRefs.current[zone.id];
                      }}
                      x={zone.x}
                      y={zone.y}
                      width={zone.w}
                      height={zone.h}
                      fill={band ? surface : zone.type === 'image' ? '#0f172a' : brand.primary}
                      opacity={band ? BAND_OPACITY : selected ? 0.2 : 0.12}
                      stroke={lineColor}
                      strokeEnabled={!band}
                      dash={editable && !selected ? dash([7, 5]) : undefined}
                      strokeWidth={ui(selected ? 2.5 : 1.4)}
                      cornerRadius={ui(3)}
                      draggable={editable}
                      onDragStart={editable ? onBegin : undefined}
                      onDragMove={editable ? handleDragMove(zone) : undefined}
                      onDragEnd={editable ? handleEnd(zone) : undefined}
                      onTransformStart={editable ? onBegin : undefined}
                      onTransform={editable ? handleTransform(zone) : undefined}
                      onTransformEnd={editable ? handleEnd(zone) : undefined}
                      onMouseDown={() => onSelect(zone.id)}
                      onTouchStart={() => onSelect(zone.id)}
                    />
                    <Text
                      x={zone.x + ui(9)}
                      y={zone.y + ui(8)}
                      text={areaName(zone.type)}
                      fontSize={ui(15)}
                      fontStyle="bold"
                      fontFamily="Inter, sans-serif"
                      fill={band ? ink : lineColor}
                      listening={false}
                    />
                    {band ? (
                      <>
                        <LockMark x={zone.x + ui(9)} y={zone.y + ui(26)} size={ui(15)} color={ink} />
                        <Text
                          x={zone.x + ui(9) + ui(15) + ui(6)}
                          y={zone.y + ui(28)}
                          text="Locked brand area"
                          fontSize={ui(12)}
                          fontFamily="Inter, sans-serif"
                          fill={ink}
                          listening={false}
                        />
                      </>
                    ) : (
                      <Text
                        x={zone.x + ui(9)}
                        y={zone.y + ui(26)}
                        text={`${zone.w} × ${zone.h}`}
                        fontSize={ui(12)}
                        fontFamily="Inter, sans-serif"
                        fill={lineColor}
                        listening={false}
                      />
                    )}
                  </React.Fragment>
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
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted">
        Positions and sizes are in poster pixels, measured from the top left. Everything moves in{' '}
        {GRID_STEP} pixel steps, and an area cannot be dragged onto a brand area or outside the poster.
      </p>
    </div>
  );
}
