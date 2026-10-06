import React, { useCallback, useEffect, useLayoutEffect, useMemo, memo, useRef, useState } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { ELEMENT_LIMITS } from '../../../shared/templateElements.js';
import { ownsPlate, platesUnder } from '../utils/templateRender.js';
import { imageOfBlank, wordsOfBlank } from '../utils/posterVariables.js';
import { posterIconComponent } from './posterIcons.js';

/* ------------------------------------------------------------------ *
 * The items a template editor places, drawn exactly where they were put.
 *
 * Every number on an item is already a poster pixel (the shared rules round them),
 * so this layer is a plain absolute box per item - no auto-layout, no scale units.
 * The preview and the export shrink the whole poster with one CSS transform, which
 * is why heights measured here are still the poster's own.
 *
 * Text is painted at the size the admin chose and only steps down towards the
 * "smallest text can get" size when the words do not fit their box - in width or in
 * height, over every wrapped line. It is never scaled up. At the smallest size allowed
 * the words are shown whole outside the box rather than cut off, and the poster says so
 * in a note outside itself.
 * ------------------------------------------------------------------ */

const FIELD_ICONS = { date: Calendar, time: Clock, venue: MapPin };
const FIELD_LABELS = { date: 'Date', time: 'Time', venue: 'Venue' };

/** A bullet in the "extra lines" item, in multiples of the line size. */
const BULLET_MARK = 0.34;
const BULLET_GAP = 0.5;

const DETAIL_LIMIT = 4;

/** How long the items must stop resizing before the poster counts as finished. */
const FIT_QUIET_MS = 150;

/** The same plain sentence the flow layout uses when words will not fit. */
const OVERFLOW_MESSAGE = 'This poster is too full. Shorten the title or details.';

function round(value) {
  return Math.round(Number(value) || 0);
}

function cssAlign(align) {
  return align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
}

/**
 * Do the words show completely in this box? Both directions count: a long word that
 * pushes past the side is as much of a problem as a wrapped line past the bottom.
 * scrollHeight and scrollWidth are the box's own content size, poster pixels included.
 */
function fitsBox(el) {
  return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
}

/** The words one item draws, or nothing at all when its part of the poster is empty. */
function wordsFor(item, content, photoUrl) {
  /* A blank a person or the assistant fills in draws its answer, and the words the designer
     left in the box when there is no answer yet. */
  if (item.kind === 'text') {
    return { text: (item.variable ? wordsOfBlank(content, item.key) : '') || (item.text || '').trim() };
  }
  if (item.kind === 'image') {
    return { image: (item.variable ? imageOfBlank(content, item.key) : '') || (item.imageUrl || '').trim() };
  }
  if (item.kind === 'shape') return { shape: item.shape || {} };

  switch (item.field) {
    case 'headline':
      return { text: (content?.title || '').trim() };
    case 'tagline':
      return { text: (content?.tagline || '').trim() };
    case 'date':
    case 'time':
    case 'venue':
      return { text: String(content?.[item.field] ?? '').trim(), field: item.field };
    case 'details': {
      const lines = (
        Array.isArray(content?.details) ? content.details : content?.details ? [content.details] : []
      )
        .map((line) => String(line).trim())
        .filter(Boolean)
        .slice(0, DETAIL_LIMIT);
      return { lines };
    }
    case 'photo':
      return { image: (photoUrl || '').trim() };
    default:
      return {};
  }
}

/** Box styles every item shares. */
function boxStyle(item, extra = {}) {
  return {
    position: 'absolute',
    left: `${round(item.x)}px`,
    top: `${round(item.y)}px`,
    width: `${round(item.w)}px`,
    height: `${round(item.h)}px`,
    boxSizing: 'border-box',
    margin: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    opacity: item.style.opacity < 1 ? item.style.opacity : undefined,
    zIndex: item.z + 1,
    ...extra,
  };
}

function TypeStyle({ style }) {
  return {
    fontFamily: `'${style.fontFamily}', sans-serif`,
    fontWeight: style.weight,
    color: style.color,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    textTransform: style.uppercase ? 'uppercase' : 'none',
    fontStyle: style.italic ? 'italic' : 'normal',
    textAlign: cssAlign(style.align),
  };
}

function Photo({ url, style }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) return null;
  return (
    <img
      src={url}
      alt=""
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: style.fit === 'contain' ? 'contain' : 'cover',
        objectPosition: 'center',
        borderRadius: style.radius ? `${round(style.radius)}px` : undefined,
        maxWidth: '100%',
        maxHeight: '100%',
      }}
    />
  );
}

function Shape({ item }) {
  const shape = item.shape || {};
  if (shape.type === 'line') {
    const thickness = Math.max(1, round(shape.strokeWidth || item.h));
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: `${thickness}px`,
          marginTop: `${-Math.round(thickness / 2)}px`,
          background: shape.fill || shape.stroke || 'transparent',
          borderRadius: `${Math.round(thickness / 2)}px`,
        }}
      />
    );
  }
  const radius = item.style.radius;
  const box = {
    position: 'absolute',
    inset: 0,
    background: shape.fill || undefined,
    border: shape.stroke && shape.strokeWidth ? `${Math.max(1, round(shape.strokeWidth))}px solid ${shape.stroke}` : undefined,
    borderRadius: shape.type === 'circle' ? '50%' : radius ? `${round(radius)}px` : undefined,
  };
  return <div aria-hidden="true" style={box} />;
}

/**
 * One of the pictures this app can draw, filling the box it was placed in.
 * The box the admin chose is square, so the mark keeps its shape at any zoom, and the
 * line thickness is the item's own. Colour and see-through come from the same box styles
 * every other item uses, so a mark can never be a colour the brand kit does not know.
 */
function PosterIcon({ item }) {
  const Icon = posterIconComponent(item.name);
  if (!Icon) return null;
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={item.style.strokeWidth}
      style={{ display: 'block', width: '100%', height: '100%', color: item.style.color }}
    />
  );
}

/**
 * One placed item. It draws nothing when it has no words, photo or shape to show.
 * Memoized: moving one item on the editor canvas never re-measures the other twenty-nine.
 *
 * `plate` is the shape these words stand on, when there is one: an info pill, a button,
 * a band. Words on a shape of their own sit in the middle of it.
 */
const ElementBox = memo(function ElementBox({
  item,
  content,
  photoUrl,
  fontsReady,
  fontTick,
  onReport,
  onActivity,
  onRow,
  plate = null,
}) {
  const boxRef = useRef(null);
  const words = useMemo(() => wordsFor(item, content, photoUrl), [item, content, photoUrl]);
  const [size, setSize] = useState(item.style.size);
  /* Words that still need more room than the box has at the smallest size allowed are
     painted outside it, so a line is never cut off. */
  const [spills, setSpills] = useState(false);

  const floor = useMemo(
    () => Math.max(ELEMENT_LIMITS.fontSize.min, Math.min(item.style.size, item.style.minSize)),
    [item.style.size, item.style.minSize]
  );

  /* New words, a new box or new fonts: start again at the size that was chosen.
     The words are compared as text, so a redraw of the same poster never restarts the fit. */
  const signature = [
    item.id,
    item.style.size,
    item.w,
    item.h,
    words.text || '',
    (words.lines || []).join('\n'),
    words.image || '',
    fontsReady,
    fontTick,
  ].join('§');

  const activityCbRef = useRef(onActivity);
  activityCbRef.current = onActivity;
  const reportCbRef = useRef(onReport);
  reportCbRef.current = onReport;
  /* Whether this item is currently complaining, so the same answer is never sent twice. */
  const flaggedRef = useRef(false);

  useEffect(() => {
    setSize(item.style.size);
    setSpills(false);
  }, [signature, item.style.size]);

  const hasText = Boolean(words.text) || (Array.isArray(words.lines) && words.lines.length > 0);

  const flag = (value) => {
    setSpills((prev) => (prev === value ? prev : value));
    if (flaggedRef.current === value) return;
    flaggedRef.current = value;
    reportCbRef.current?.(item.id, value);
  };

  /* The box no longer shows words (an empty field, a photo that failed): stop complaining. */
  useEffect(
    () => () => reportCbRef.current?.(item.id, false),
    [item.id]
  );

  /* Fit the words into the box: shrink a step at a time, never below the size the
     admin said was still readable, and never grow past what was chosen. Measuring only
     makes sense once the real typeface is on screen, so it waits for `fontsReady`, and it
     runs again whenever a font arrives late. */
  useLayoutEffect(() => {
    if (!hasText) {
      flag(false);
      return;
    }
    const el = boxRef.current;
    if (!el || !fontsReady) return;
    if (fitsBox(el)) {
      flag(false);
      return;
    }
    if (size > floor) {
      activityCbRef.current?.();
      setSize(Math.max(floor, size - Math.max(1, Math.round(size * 0.08))));
      return;
    }
    /* At the smallest size the admin allowed the words stay whole: they are painted past
       the box instead of being cut off, and the note outside the poster says so. */
    flag(true);
  }, [hasText, fontsReady, signature, size, floor]);

  /* Words that stand on a shape of their own sit in the middle of it. */
  const onPlate = Boolean(plate);
  const ownsShape = ownsPlate(item, plate);
  const valign = onPlate ? 'center' : 'flex-start';
  const halign = ownsShape ? 'center' : cssAlign(item.style.align);
  /* A box too small for its words shows them anyway - clipping a line is worse. */
  const spill = spills ? { overflow: 'visible' } : null;

  const type = TypeStyle({ style: { ...item.style, size } });

  if (item.kind === 'shape') {
    return (
      <div data-element={item.id} style={boxStyle(item)}>
        <Shape item={item} />
      </div>
    );
  }

  if (item.kind === 'icon') {
    return (
      <div data-element={item.id} style={boxStyle(item)}>
        <PosterIcon item={item} />
      </div>
    );
  }

  if (item.kind === 'image' || item.field === 'photo') {
    /* An empty photo is not drawn at all - no box, no frame, in the poster and the export. */
    if (!words.image) return null;
    return (
      <div data-element={item.id} style={boxStyle(item, { borderRadius: item.style.radius ? `${round(item.style.radius)}px` : undefined })}>
        <Photo url={words.image} style={item.style} />
      </div>
    );
  }

  if (!hasText) return null;

  const Icon = words.field ? FIELD_ICONS[words.field] : null;
  const label = words.field && item.style.showLabel ? FIELD_LABELS[words.field] : '';
  const showIcon = Boolean(Icon) && item.style.showIcon !== false;
  const lineHeight = item.style.lineHeight;

  if (Array.isArray(words.lines)) {
    const mark = Math.max(3, Math.round(size * BULLET_MARK));
    return (
      <ul
        ref={boxRef}
        data-element={item.id}
        style={boxStyle(item, {
          ...type,
          listStyle: 'none',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: ownsShape ? 'center' : 'stretch',
          justifyContent: valign,
          gap: `${Math.round(size * BULLET_GAP)}px`,
          ...spill,
        })}
      >
        {words.lines.map((line, index) => (
          <li
            key={`${line}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: `${mark + Math.round(size * 0.28)}px`,
              fontSize: `${size}px`,
              lineHeight,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: `${mark}px`,
                height: `${mark}px`,
                borderRadius: '50%',
                background: item.style.color,
                flexShrink: 0,
                marginTop: `${Math.max(2, Math.round((size * lineHeight - mark) / 2))}px`,
              }}
            />
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{line}</span>
          </li>
        ))}
      </ul>
    );
  }

  const gap = `${Math.max(2, Math.round(size * (showIcon ? 0.4 : 0.12)))}px`;
  const iconNode = showIcon ? (
    <Icon
      aria-hidden="true"
      style={{ width: `${Math.round(size * 1.15)}px`, height: `${Math.round(size * 1.15)}px`, flexShrink: 0, color: item.style.color }}
      strokeWidth={1.8}
    />
  ) : null;
  const wordsNode = (
    <div style={{ minWidth: 0, maxWidth: '100%' }}>
      {label ? (
        <div
          style={{
            ...type,
            fontSize: `${Math.max(8, Math.round(size * 0.42))}px`,
            lineHeight: 1.1,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.6,
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          ...type,
          fontSize: `${size}px`,
          lineHeight,
          overflowWrap: 'anywhere',
        }}
      >
        {words.text}
      </div>
    </div>
  );

  /* Date, place and time of one info row stand on one line: each of them is its own box of
     the same height, so the words are put at the bottom of their box instead of at the top -
     unless the row sits on a pill, which holds them in its middle. */
  if (onRow) {
    return (
      <div
        ref={boxRef}
        data-element={item.id}
        style={boxStyle(item, {
          display: 'flex',
          flexDirection: 'column',
          alignItems: halign,
          justifyContent: onPlate ? 'center' : 'flex-end',
          ...spill,
        })}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap,
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          {iconNode}
          {wordsNode}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      data-element={item.id}
      style={boxStyle(item, {
        display: 'flex',
        flexDirection: showIcon ? 'row' : 'column',
        alignItems: showIcon ? 'center' : halign,
        justifyContent: ownsShape ? 'center' : showIcon ? 'flex-start' : valign,
        gap,
        ...spill,
      })}
    >
      {iconNode}
      {wordsNode}
    </div>
  );
});

/** Which items share a row of the info pill, so their words can stand on one line. */
const ROW_FIELDS = ['date', 'time', 'venue'];

function rowItemIds(items) {
  const rows = new Map();
  items.forEach((item) => {
    if (item.kind !== 'field' || !ROW_FIELDS.includes(item.field)) return;
    const key = `${round(item.y)}/${round(item.h)}`;
    const row = rows.get(key);
    if (row) row.push(item.id);
    else rows.set(key, [item.id]);
  });
  const ids = new Set();
  rows.forEach((row) => {
    if (row.length > 1) row.forEach((id) => ids.add(id));
  });
  return ids;
}

/** The words and photos the poster carries, as one string. Content arrives as a fresh
 *  object on every render, so the reset below compares text, not identity. */
function contentKeyOf(content, photoUrl) {
  const details = (
    Array.isArray(content?.details) ? content.details : content?.details ? [content.details] : []
  )
    .map((line) => String(line).trim())
    .filter(Boolean)
    .slice(0, DETAIL_LIMIT)
    .join('\n');
  return [
    String(content?.title || '').trim(),
    String(content?.tagline || '').trim(),
    String(content?.date ?? '').trim(),
    String(content?.time ?? '').trim(),
    String(content?.venue ?? '').trim(),
    details,
    photoUrl || '',
    /* The filled-in blanks travel with the rest, or a new answer would never re-measure. */
    valuesKeyOf(content?.extras),
    valuesKeyOf(content?.images),
  ].join('§');
}

function valuesKeyOf(record) {
  if (!record || typeof record !== 'object') return '';
  return Object.keys(record)
    .sort()
    .map((key) => `${key}=${String(record[key] || '').trim()}`)
    .join(';');
}

export default function PosterElementLayer({
  elements,
  content,
  photoUrl,
  fontsReady,
  onOverflow = null,
  onFitted = null,
}) {
  const overflowCbRef = useRef(onOverflow);
  overflowCbRef.current = onOverflow;
  const fittedCbRef = useRef(onFitted);
  fittedCbRef.current = onFitted;

  /* A web font can still be on its way when the poster first paints. When one arrives,
     every item starts again at the size it was given and measures with the real face. */
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return undefined;
    let alive = true;
    const bump = () => {
      if (alive) setFontTick((n) => n + 1);
    };
    if (typeof fonts.addEventListener === 'function') fonts.addEventListener('loadingdone', bump);
    if (typeof fonts.ready?.then === 'function') fonts.ready.then(bump, () => {});
    return () => {
      alive = false;
      if (typeof fonts.removeEventListener === 'function') fonts.removeEventListener('loadingdone', bump);
    };
  }, []);

  const ordered = useMemo(
    () =>
      (Array.isArray(elements) ? elements : [])
        .map((item, index) => ({ item, index }))
        /* Sorted by stacking order, and stable for items that share one. */
        .sort((a, b) => a.item.z - b.item.z || a.index - b.index)
        .map(({ item }) => item),
    [elements]
  );

  /* Date, place and time of one row stand on one line, whatever each one says. */
  const rows = useMemo(() => rowItemIds(ordered), [ordered]);

  /* The shape each item's words stand on, so a pill or a button holds its words in the
     middle and the rest keep their own place. */
  const plates = useMemo(() => platesUnder(ordered), [ordered]);

  const layerKey = [
    ordered
      .map(
        (item) =>
          `${item.id}:${round(item.x)},${round(item.y)},${round(item.w)}x${round(item.h)}#${item.z}:${
            item.style.size
          }:${item.text || ''}:${item.imageUrl || ''}`
      )
      .join('|'),
    contentKeyOf(content, photoUrl),
  ].join('§');

  /* Which items cannot show their words at the smallest size they allow. */
  const [flagged, setFlagged] = useState(() => ({}));
  const report = useCallback((id, isOver) => {
    setFlagged((prev) => {
      if (Boolean(prev[id]) === isOver) return prev;
      const next = { ...prev };
      if (isOver) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);

  const anyOverflow = Object.keys(flagged).length > 0;
  useEffect(() => {
    overflowCbRef.current?.(anyOverflow, anyOverflow ? OVERFLOW_MESSAGE : null);
  }, [anyOverflow]);

  /* The items are finished with when nothing has resized for a moment. */
  const [resizing, setResizing] = useState(0);
  const markResizing = useCallback(() => setResizing((n) => n + 1), []);
  useEffect(() => {
    if (!fontsReady) return undefined;
    const id = setTimeout(() => fittedCbRef.current?.(), FIT_QUIET_MS);
    return () => clearTimeout(id);
  }, [fontsReady, resizing, layerKey, fontTick]);

  return (
    <>
      {ordered.map((item) => (
        <ElementBox
          key={item.id}
          item={item}
          content={content}
          photoUrl={photoUrl}
          fontsReady={fontsReady}
          fontTick={fontTick}
          onReport={report}
          onActivity={markResizing}
          onRow={rows.has(item.id)}
          plate={plates.get(item.id) || null}
        />
      ))}
    </>
  );
}
