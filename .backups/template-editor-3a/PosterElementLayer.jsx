import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { ELEMENT_LIMITS } from '../../../shared/templateElements.js';

/* ------------------------------------------------------------------ *
 * The items a template editor places, drawn exactly where they were put.
 *
 * Every number on an item is already a poster pixel (the shared rules round them),
 * so this layer is a plain absolute box per item - no auto-layout, no scale units.
 * The preview and the export shrink the whole poster with one CSS transform, which
 * is why heights measured here are still the poster's own.
 *
 * Text is painted at the size the admin chose and only steps down towards the
 * "smallest text can get" size when the words do not fit their box. It is never
 * scaled up, and it never spills outside.
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

/** The words one item draws, or nothing at all when its part of the poster is empty. */
function wordsFor(item, content, photoUrl) {
  if (item.kind === 'text') return { text: (item.text || '').trim() };
  if (item.kind === 'image') return { image: (item.imageUrl || '').trim() };
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

/** One placed item. It draws nothing when it has no words, photo or shape to show. */
function ElementBox({ item, content, photoUrl, fontsReady, fontTick, onReport, onActivity }) {
  const boxRef = useRef(null);
  const words = useMemo(() => wordsFor(item, content, photoUrl), [item, content, photoUrl]);
  const [size, setSize] = useState(item.style.size);

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
  }, [signature, item.style.size]);

  const hasText = Boolean(words.text) || (Array.isArray(words.lines) && words.lines.length > 0);

  const flag = (value) => {
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
     makes sense once the real typeface is on screen, so it waits for `fontsReady`. */
  useLayoutEffect(() => {
    if (!hasText) {
      flag(false);
      return;
    }
    const el = boxRef.current;
    if (!el || !fontsReady) return;
    if (el.scrollHeight <= el.clientHeight + 1) {
      flag(false);
      return;
    }
    if (size > floor) {
      activityCbRef.current?.();
      setSize(Math.max(floor, size - Math.max(1, Math.round(size * 0.08))));
      return;
    }
    /* Only now, at the smallest size the admin allowed, is the note raised. */
    flag(true);
  }, [hasText, fontsReady, signature, size, floor]);

  const type = TypeStyle({ style: { ...item.style, size } });

  if (item.kind === 'shape') {
    return (
      <div data-element={item.id} style={boxStyle(item)}>
        <Shape item={item} />
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
          gap: `${Math.round(size * BULLET_GAP)}px`,
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

  return (
    <div
      ref={boxRef}
      data-element={item.id}
      style={boxStyle(item, {
        display: 'flex',
        flexDirection: showIcon ? 'row' : 'column',
        alignItems: showIcon ? 'center' : cssAlign(item.style.align),
        justifyContent: showIcon ? cssAlign(item.style.align) : 'flex-start',
        gap: `${Math.max(2, Math.round(size * (showIcon ? 0.4 : 0.12)))}px`,
      })}
    >
      {showIcon ? (
        <Icon
          aria-hidden="true"
          style={{ width: `${Math.round(size * 1.15)}px`, height: `${Math.round(size * 1.15)}px`, flexShrink: 0, color: item.style.color }}
          strokeWidth={1.8}
        />
      ) : null}
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
    </div>
  );
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
  ].join('§');
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
        />
      ))}
    </>
  );
}
