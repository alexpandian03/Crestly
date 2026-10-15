import React, { useCallback, useEffect, useLayoutEffect, useMemo, memo, useRef, useState } from 'react';
import { AlertTriangle, Calendar, Clock, Image as ImageIcon, MapPin } from 'lucide-react';
import { ELEMENT_LIMITS, iconForWords, isSamplePlaceholder, resolveItemImage } from '../../../shared/templateElements.js';
import { fontStackFor, tamilCssOverrides } from '../../../shared/textScripts.js';
import { ownsPlate, platesUnder } from '../utils/templateRender.js';
import { imageOfBlank, wordsOfBlank } from '../utils/posterVariables.js';
import { transformCloudinaryUrl } from '../utils/brandRender.js';
import { posterIconComponent } from './posterIcons.js';
import { makeSampleEntries } from '../utils/cardListHelpers.js';
import { computeItemNumbers } from '../utils/templateEditorItems.js';

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

export { isSamplePlaceholder, wordsFor };

/** The words one item draws, or nothing at all when its part of the poster is empty. */
function wordsFor(
  item,
  content,
  photoUrl,
  isEditor = false,
  isFirstUserSlot = false,
  isExporting = false,
  showPlaceholders = true,
  isThumbnail = false
) {
  /* A blank a person or the assistant fills in draws its answer.
     When not in the editor, never show sample text or example copy. */
  if (item.kind === 'text') {
    let text = (item.variable ? wordsOfBlank(content, item.key) : '') || '';
    if (!isEditor && isSamplePlaceholder(text)) {
      text = '';
    }
    let isPlaceholder = false;
    if (!text) {
      if (isEditor) {
        text = (item.sample || item.text || item.label || 'Sample text').trim();
      } else if (item.variable) {
        if (!isExporting && !isThumbnail && showPlaceholders) {
          text = (item.sample || item.label || 'Text space').trim();
          isPlaceholder = true;
        } else {
          text = '';
        }
      } else if (!item.variable) {
        const raw = (item.text || '').trim();
        if (!isSamplePlaceholder(raw)) {
          text = raw;
        }
      }
    }
    return { text: text.trim(), isPlaceholder };
  }
  if (item.kind === 'image' || item.field === 'photo') {
    return { image: resolveItemImage(item, content, photoUrl, isFirstUserSlot, { isExporting }) };
  }
  if (item.kind === 'shape') return { shape: item.shape || {} };

  switch (item.field) {
    case 'headline':
      return { text: (content?.title || '').trim() };
    case 'tagline': {
      const tag = (content?.tagline || content?.subtitle || '').trim();
      return { text: !isEditor && isSamplePlaceholder(tag) ? '' : tag };
    }
    case 'date': {
      const d = String(content?.date || '').trim();
      return { text: d || (isEditor ? (item.text || 'Date') : 'Date to be announced'), field: 'date' };
    }
    case 'time': {
      const tm = String(content?.time || '').trim();
      return { text: tm || (isEditor ? (item.text || 'Time') : ''), field: 'time' };
    }
    case 'venue': {
      const v = String(content?.venue || '').trim();
      return { text: v || (isEditor ? (item.text || 'Venue') : 'Venue to be announced'), field: 'venue' };
    }
    case 'details': {
      const lines = (
        Array.isArray(content?.details) ? content.details : content?.details ? [content.details] : []
      )
        .map((line) => String(line).trim())
        .filter((line) => Boolean(line) && (isEditor || !isSamplePlaceholder(line)))
        .slice(0, DETAIL_LIMIT);
      return { lines };
    }
    default:
      return {};
  }
}

const MASK_CLIP_PATHS = {
  circle: 'circle(50% at 50% 50%)',
  triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  blob: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
};

export function getMaskStyle(mask, radius = 0) {
  const m = typeof mask === 'string' ? mask.trim().toLowerCase() : 'none';
  if (m === 'rounded') {
    return { borderRadius: radius ? `${round(radius)}px` : '16px' };
  }
  if (m === 'circle') {
    return {
      borderRadius: '50%',
      clipPath: MASK_CLIP_PATHS.circle,
      WebkitClipPath: MASK_CLIP_PATHS.circle,
    };
  }
  if (m === 'blob') {
    return {
      borderRadius: '42% 58% 70% 30% / 45% 45% 55% 55%',
      clipPath: MASK_CLIP_PATHS.blob,
      WebkitClipPath: MASK_CLIP_PATHS.blob,
    };
  }
  if (MASK_CLIP_PATHS[m]) {
    return {
      clipPath: MASK_CLIP_PATHS[m],
      WebkitClipPath: MASK_CLIP_PATHS[m],
    };
  }
  if (radius) {
    return { borderRadius: `${round(radius)}px` };
  }
  return {};
}

/** Box styles every item shares. */
function boxStyle(item, extra = {}) {
  const rot = Number(item.rotation) || 0;
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
    opacity: (typeof item.style?.opacity === 'number' && item.style.opacity < 1)
      ? item.style.opacity
      : (typeof item.shape?.opacity === 'number' && item.shape.opacity < 1 ? item.shape.opacity : undefined),
    transform: rot ? `rotate(${rot}deg)` : undefined,
    transformOrigin: '50% 50%',
    zIndex: (item.z ?? 0) + 1,
    ...extra,
  };
}

/** The leading these words need: Tamil tails must not ride into the line below. */
const leadFor = (text, fallback) => tamilCssOverrides(text, { lineHeight: fallback }).lineHeight || fallback;

function TypeStyle({ style, text = '' }) {
  let textShadow = undefined;
  let webkitTextStroke = undefined;
  if (style.effect === 'shadow') {
    textShadow = '0 3px 8px rgba(0,0,0,0.45)';
  } else if (style.effect === 'lift') {
    textShadow = '0 8px 24px rgba(0,0,0,0.6)';
  } else if (style.effect === 'outline' || style.outline) {
    const strokeColor = style.outlineColor || '#000000';
    const strokeWidth = style.outlineWidth || 1;
    webkitTextStroke = `${strokeWidth}px ${strokeColor}`;
    textShadow = `-1px -1px 0 ${strokeColor}, 1px -1px 0 ${strokeColor}, -1px 1px 0 ${strokeColor}, 1px 1px 0 ${strokeColor}`;
  } else if (style.textShadow) {
    textShadow = style.textShadow;
  }

  return {
    fontFamily: fontStackFor(style.fontFamily, text),
    fontWeight: style.weight,
    color: style.color,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    textTransform: style.textTransform || (style.uppercase ? 'uppercase' : 'none'),
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.textDecoration || (style.underline ? 'underline' : (style.strike ? 'line-through' : undefined)),
    textAlign: cssAlign(style.align),
    textShadow,
    WebkitTextStroke: webkitTextStroke,
    /* Tamil is spread last: its clusters cannot be spaced out or capitalised. */
    ...tamilCssOverrides(text, { lineHeight: style.lineHeight }),
  };
}

function Photo({ url, item, style, mask, isEditor = false, onImageFail }) {
  const [failed, setFailed] = useState(false);
  const [isLowRes, setIsLowRes] = useState(false);

  useEffect(() => {
    setFailed(false);
    setIsLowRes(false);
  }, [url]);

  if (!url || failed) return null;

  const maskStyle = getMaskStyle(mask || style?.mask, style?.radius);

  // Transforms: crop pan/zoom and horizontal/vertical flip
  const flipX = style?.flipX ? -1 : 1;
  const flipY = style?.flipY ? -1 : 1;
  const crop = style?.crop || {};
  const cropZoom = Math.min(3, Math.max(1, Number(crop.zoom) || 1));
  const cropX = Math.min(50, Math.max(-50, Number(crop.x) || 0));
  const cropY = Math.min(50, Math.max(-50, Number(crop.y) || 0));

  const transformParts = [];
  if (cropX || cropY) transformParts.push(`translate(${cropX}%, ${cropY}%)`);
  if (cropZoom !== 1) transformParts.push(`scale(${cropZoom})`);
  if (flipX !== 1 || flipY !== 1) transformParts.push(`scale(${flipX}, ${flipY})`);
  const imgTransform = transformParts.length > 0 ? transformParts.join(' ') : undefined;

  // Simple CSS filters (brightness, contrast, grayscale)
  const filterParts = [];
  const brightness = typeof style?.brightness === 'number' ? style.brightness : 100;
  const contrast = typeof style?.contrast === 'number' ? style.contrast : 100;
  if (brightness !== 100) filterParts.push(`brightness(${brightness}%)`);
  if (contrast !== 100) filterParts.push(`contrast(${contrast}%)`);
  if (style?.grayscale) filterParts.push('grayscale(100%)');
  const imgFilter = filterParts.length > 0 ? filterParts.join(' ') : undefined;

  const handleLoad = (e) => {
    const img = e.currentTarget;
    if (img && img.naturalWidth && img.naturalHeight && item?.w && item?.h) {
      // Friendly low-resolution warning when image is significantly smaller than the slot
      if (img.naturalWidth < item.w * 0.8 || img.naturalHeight < item.h * 0.8) {
        setIsLowRes(true);
      } else {
        setIsLowRes(false);
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...maskStyle }}>
      <img
        src={url}
        alt=""
        crossOrigin="anonymous"
        onLoad={handleLoad}
        onError={() => {
          setFailed(true);
          onImageFail?.();
        }}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: style?.fit === 'contain' ? 'contain' : 'cover',
          objectPosition: 'center',
          maxWidth: '100%',
          maxHeight: '100%',
          transform: imgTransform,
          transformOrigin: 'center center',
          filter: imgFilter,
          WebkitFilter: imgFilter,
        }}
      />
      {isEditor && isLowRes && (
        <div
          data-export-ignore="true"
          title="This photo is small and may appear blurry when printed."
          style={{
            position: 'absolute',
            bottom: 6,
            left: 6,
            zIndex: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            backgroundColor: 'rgba(217, 119, 6, 0.92)',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            cursor: 'help',
          }}
        >
          <AlertTriangle style={{ width: 12, height: 12 }} />
          <span>Small photo — may look blurry</span>
        </div>
      )}
    </div>
  );
}

function Shape({ item }) {
  const shape = item.shape || {};
  const type = shape.type || 'rect';
  if (type === 'line') {
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
  if (['triangle', 'star', 'hexagon', 'diamond'].includes(type)) {
    const pointsMap = {
      triangle: '50,0 0,100 100,100',
      diamond: '50,0 100,50 50,100 0,50',
      hexagon: '25,0 75,0 100,50 75,100 25,100 0,50',
      star: '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35',
    };
    const clipPath = MASK_CLIP_PATHS[type];
    const sw = shape.stroke && shape.strokeWidth ? Math.max(1, round(shape.strokeWidth)) : 0;
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {shape.fill ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              background: shape.fill,
              clipPath,
              WebkitClipPath: clipPath,
            }}
          />
        ) : null}
        {sw > 0 ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              display: 'block',
            }}
          >
            <polygon
              points={pointsMap[type]}
              fill="none"
              stroke={shape.stroke}
              strokeWidth={sw}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
      </div>
    );
  }
  const radius = shape.radius ?? item.style?.radius;
  const isCircle = type === 'circle';
  const isRounded = type === 'rounded-rect' || type === 'rounded' || Boolean(radius);
  const borderRadius = isCircle ? '50%' : isRounded ? `${round(radius || 16)}px` : undefined;
  const box = {
    position: 'absolute',
    inset: 0,
    background: shape.fill || undefined,
    border: shape.stroke && shape.strokeWidth ? `${Math.max(1, round(shape.strokeWidth))}px solid ${shape.stroke}` : undefined,
    borderRadius,
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
 * Lays out card list items in a grid by columns, gap, align and real entry count,
 * centering the last row when incomplete. Each card is drawn from card.items
 * populated with entry values.
 */
function CardListBox({
  item,
  content,
  fontsReady,
  fontTick,
  onReport,
  onActivity,
  isEditor = false,
  onImageFail = null,
}) {
  const rawEntries = content?.lists?.[item.key];
  let entries = Array.isArray(rawEntries) && rawEntries.length > 0 ? rawEntries : [];
  if (entries.length === 0) {
    if (!isEditor) return null;
    const sampleCount = Number(item.previewCount) || 3;
    entries = makeSampleEntries(item.card, sampleCount);
  }

  const cols = Math.max(1, Math.min(5, Number(item.columns) || 1));
  const gapX = Math.max(0, Number(item.gapX) || 16);
  const gapY = Math.max(0, Number(item.gapY) || 16);
  const align = item.align || 'left';
  const cardW = Math.max(40, Number(item.card?.w) || 300);
  const cardH = Math.max(24, Number(item.card?.h) || 150);
  const totalEntries = entries.length;
  const totalRows = Math.ceil(totalEntries / cols);

  const renderedCards = entries.map((entry, idx) => {
    const rowIdx = Math.floor(idx / cols);
    const colIdx = idx % cols;
    const isLastRow = rowIdx === totalRows - 1;
    const itemsInThisRow = isLastRow ? (totalEntries % cols || cols) : cols;
    const rowW = itemsInThisRow * cardW + (itemsInThisRow - 1) * gapX;

    let rowStartX = 0;
    if (isLastRow && itemsInThisRow < cols) {
      rowStartX = Math.max(0, (item.w - rowW) / 2);
    } else if (align === 'center') {
      rowStartX = Math.max(0, (item.w - (cols * cardW + (cols - 1) * gapX)) / 2);
    } else if (align === 'right') {
      rowStartX = Math.max(0, item.w - (cols * cardW + (cols - 1) * gapX));
    }

    const cardX = round(item.x + rowStartX + colIdx * (cardW + gapX));
    const cardY = round(item.y + rowIdx * (cardH + gapY));

    const cardItems = (item.card?.items || []).map((cardItem, cIdx) => {
      const resolved = { ...cardItem };
      if (resolved.kind === 'text') {
        let val = resolved.fieldKey && entry[resolved.fieldKey] !== undefined ? entry[resolved.fieldKey] : resolved.text || '';
        if (typeof val === 'string' && val.includes('{{')) {
          val = val.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => entry[k] ?? '');
        }
        resolved.text = val;
      }
      if (resolved.kind === 'image') {
        let imgUrl = resolved.fieldKey && entry[resolved.fieldKey] ? entry[resolved.fieldKey] : resolved.imageUrl || '';
        if (typeof imgUrl === 'string' && imgUrl.includes('{{')) {
          imgUrl = imgUrl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => entry[k] ?? '');
        }
        resolved.imageUrl = imgUrl;
      }
      resolved.x = cardX + cardItem.x;
      resolved.y = cardY + cardItem.y;
      resolved.id = `${item.id}-c${idx}-i${cIdx}`;
      return resolved;
    });

    return { idx, cardX, cardY, cardItems };
  });

  return (
    <React.Fragment>
      {renderedCards.map((c) =>
        c.cardItems.map((cItem) => (
          <ElementBox
            key={cItem.id}
            item={cItem}
            content={content}
            fontsReady={fontsReady}
            fontTick={fontTick}
            onReport={onReport}
            onActivity={onActivity}
            isEditor={isEditor}
            onImageFail={onImageFail}
          />
        ))
      )}
    </React.Fragment>
  );
}

/**
 * One placed item. It draws nothing when it has no words, photo or shape to show.
 * Memoized: moving one item on the editor canvas never re-measures the other twenty-nine.
 *
 * `plate` is the shape these words stand on, when there is one: an info pill, a button,
 * a band. Words on a shape of their own sit in the middle of it.
 */
const ElementBoxInner = memo(function ElementBoxInner({
  item,
  content,
  photoUrl,
  fontsReady,
  fontTick,
  onReport,
  onActivity,
  onRow,
  plate = null,
  isEditor = false,
  isFirstUserSlot = false,
  onImageFail = null,
  isExporting = false,
  showPlaceholders = true,
  highlightSlotKey = null,
  onSlotClick = null,
  isThumbnail = false,
  numInfo = null,
}) {
  const boxRef = useRef(null);
  const words = useMemo(
    () => wordsFor(item, content, photoUrl, isEditor, isFirstUserSlot, isExporting, showPlaceholders, isThumbnail),
    [item, content, photoUrl, isEditor, isFirstUserSlot, isExporting, showPlaceholders, isThumbnail]
  );
  const [size, setSize] = useState(item.style.size);
  /* Words that still need more room than the box has at the smallest size allowed are
     painted outside it, so a line is never cut off. */
  const [spills, setSpills] = useState(false);

  const floor = useMemo(
    () => Math.max(22, ELEMENT_LIMITS.fontSize.min, Math.min(item.style.size, item.style.minSize || 22)),
    [item.style.size, item.style.minSize]
  );

  const isHighlighted = Boolean(highlightSlotKey && item.key === highlightSlotKey);
  const handleSlotClick = onSlotClick && item.variable && item.key ? (e) => {
    e.stopPropagation();
    onSlotClick(item.key);
  } : undefined;

  const highlightStyle = isHighlighted ? {
    outline: '3px solid #2563EB',
    outlineOffset: '2px',
    boxShadow: '0 0 0 4px rgba(37,99,235,0.3)',
    animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    zIndex: 50,
  } : null;

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

  /* The whole of what this item shows, read once: Tamil words change its leading,
     its spacing, its capitals and the face that shapes its letters. */
  const itemWords = Array.isArray(words.lines) ? words.lines.join(' ') : words.text || '';
  const type = TypeStyle({ style: { ...item.style, size }, text: itemWords });

  if (item.kind === 'cardlist') {
    return (
      <CardListBox
        item={item}
        content={content}
        fontsReady={fontsReady}
        fontTick={fontTick}
        onReport={onReport}
        onActivity={onActivity}
        isEditor={isEditor}
        onImageFail={onImageFail}
      />
    );
  }

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
    const mask = item.mask || item.style?.mask;
    const maskStyle = getMaskStyle(mask, item.style?.radius);
    if (!words.image) {
      if (item.variable && !isEditor) {
        if (isExporting || isThumbnail || !showPlaceholders) {
          return null;
        }
        const sampleImg = item.sampleImage || item.imageUrl;
        return (
          <div
            data-element={item.id}
            data-export-ignore="true"
            onClick={handleSlotClick}
            style={boxStyle(item, {
              ...maskStyle,
              background: '#F3F4F6',
              border: '2px dashed #9CA3AF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              textAlign: 'center',
              boxSizing: 'border-box',
              userSelect: 'none',
              cursor: onSlotClick ? 'pointer' : 'default',
              pointerEvents: onSlotClick ? 'auto' : 'none',
              ...highlightStyle,
            })}
          >
            {sampleImg ? (
              <img
                src={sampleImg}
                alt=""
                crossOrigin="anonymous"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.35,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4B5563',
                marginBottom: 4,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <ImageIcon style={{ width: 16, height: 16 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', lineHeight: 1.2, position: 'relative', zIndex: 1 }}>
              {item.label || (numInfo ? numInfo.label : 'Photo space')}
            </span>
            <span
              data-export-ignore="true"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                zIndex: 30,
                fontSize: '11px',
                fontWeight: 700,
                lineHeight: 1,
                padding: '2px 5px',
                borderRadius: '4px',
                backgroundColor: '#2563EB',
                color: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {numInfo ? numInfo.label : 'Photo'}
            </span>
          </div>
        );
      }

      // In editor mode, a variable image slot shows a clean placeholder tile marked with data-export-ignore
      if (item.variable && isEditor) {
        return (
          <div
            data-element={item.id}
            data-export-ignore="true"
            style={boxStyle(item, {
              ...maskStyle,
              background: '#F0F7FF',
              border: '2px dashed #93C5FD',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              textAlign: 'center',
              boxSizing: 'border-box',
              userSelect: 'none',
            })}
          >
            {/* The designer's own picture shows here faintly, as an example of what fits this
               space. It is never a poster's answer, and this whole tile never exports. */}
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.18,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB',
                marginBottom: 6,
              }}
            >
              <ImageIcon style={{ width: 18, height: 18 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A', lineHeight: 1.2 }}>
              {item.label || 'Photo space'}
            </span>
            <span style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>
              {item.hint || 'Users replace this photo'}
            </span>
            {item.aspectRatio && (
              <span
                style={{
                  marginTop: 6,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  backgroundColor: 'rgba(191, 219, 254, 0.7)',
                  color: '#1E40AF',
                  borderRadius: 4,
                }}
              >
                {item.aspectRatio}
              </span>
            )}
          </div>
        );
      }

      const FallbackIcon = posterIconComponent(item.icon || item.name || iconForWords(content?.title || item.field || 'image') || 'heart-pulse') || FIELD_ICONS.venue;
      const fillColor = item.style?.fill || item.style?.background || (item.style?.color ? `${item.style.color}15` : 'rgba(0,0,0,0.06)');
      const iconColor = item.style?.iconColor || item.style?.color || 'currentColor';
      return (
        <div
          data-element={item.id}
          style={boxStyle(item, {
            ...maskStyle,
            background: fillColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {FallbackIcon && (
            <FallbackIcon
              aria-hidden="true"
              style={{
                width: `${Math.min(round(item.w * 0.35), round(item.h * 0.35), 96)}px`,
                height: `${Math.min(round(item.w * 0.35), round(item.h * 0.35), 96)}px`,
                color: iconColor,
                opacity: 0.75,
              }}
            />
          )}
        </div>
      );
    }
    const transformedUrl = transformCloudinaryUrl(words.image, { w: item.w, h: item.h });
    return (
      <div
        data-element={item.id}
        onClick={handleSlotClick}
        style={boxStyle(item, {
          ...maskStyle,
          ...highlightStyle,
          cursor: onSlotClick && item.variable ? 'pointer' : undefined,
          pointerEvents: onSlotClick && item.variable ? 'auto' : undefined,
        })}
      >
        <Photo url={transformedUrl} item={item} style={item.style} mask={mask} isEditor={isEditor} onImageFail={onImageFail} />
      </div>
    );
  }

  if (!hasText) return null;

  const Icon = words.field ? FIELD_ICONS[words.field] : null;
  const isFactField = words.field && ROW_FIELDS.includes(words.field);
  const label = isFactField
    ? words.field.toUpperCase()
    : words.field && item.style.showLabel
      ? FIELD_LABELS[words.field]
      : '';
  const showIcon = !isFactField && Boolean(Icon) && item.style.showIcon !== false;
  const lineHeight = leadFor(itemWords, item.style.lineHeight);

  if (Array.isArray(words.lines)) {
    const mark = Math.max(3, Math.round(size * BULLET_MARK));
    return (
      <ul
        ref={boxRef}
        data-element={item.id}
        onClick={handleSlotClick}
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
          ...highlightStyle,
          cursor: onSlotClick && item.variable ? 'pointer' : undefined,
          pointerEvents: onSlotClick && item.variable ? 'auto' : undefined,
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
            <span style={{ minWidth: 0, overflowWrap: 'normal', wordBreak: 'normal', whiteSpace: 'normal' }}>{line}</span>
          </li>
        ))}
      </ul>
    );
  }

  const labelSize = isFactField ? 20 : Math.max(8, Math.round(size * 0.42));
  const isLongVenue = words.field === 'venue' && (words.text || '').length > 18;
  const valSize = isFactField ? (isLongVenue ? 24 : 32) : size;

  const gap = `${Math.max(2, Math.round(size * (showIcon ? 0.4 : 0.12)))}px`;
  const iconNode = showIcon ? (
    <Icon
      aria-hidden="true"
      style={{ width: `${Math.round(size * 1.15)}px`, height: `${Math.round(size * 1.15)}px`, flexShrink: 0, color: item.style.color }}
      strokeWidth={1.8}
    />
  ) : null;
  const wordsNode = (
    <div style={{ minWidth: 0, maxWidth: '100%', textAlign: isFactField ? 'center' : type.textAlign }}>
      {label ? (
        <div
          style={{
            ...type,
            fontSize: `${labelSize}px`,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.65,
            marginBottom: '6px',
            textAlign: isFactField ? 'center' : type.textAlign,
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          ...type,
          fontSize: `${valSize}px`,
          fontWeight: isFactField ? 700 : type.fontWeight,
          lineHeight: isFactField ? leadFor(itemWords, 1.18) : lineHeight,
          textAlign: isFactField ? 'center' : type.textAlign,
          overflowWrap: 'normal',
          wordBreak: 'normal',
          whiteSpace: 'normal',
        }}
      >
        {words.text}
      </div>
    </div>
  );

  const placeholderBadge = words.isPlaceholder ? (
    <span
      data-export-ignore="true"
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        zIndex: 30,
        fontSize: '11px',
        fontWeight: 700,
        lineHeight: 1,
        padding: '2px 5px',
        borderRadius: '4px',
        backgroundColor: '#2563EB',
        color: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {numInfo ? numInfo.label : 'Text'}
    </span>
  ) : null;

  /* Date, place and time of one info row stand on one line: each of them is its own card box */
  if (onRow || isFactField) {
    return (
      <div
        ref={boxRef}
        data-element={item.id}
        {...(words.isPlaceholder ? { 'data-export-ignore': 'true' } : {})}
        onClick={handleSlotClick}
        style={boxStyle(item, {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          ...spill,
          ...(words.isPlaceholder ? { opacity: 0.45, fontStyle: 'italic' } : {}),
          ...highlightStyle,
          cursor: onSlotClick && item.variable ? 'pointer' : undefined,
          pointerEvents: onSlotClick && item.variable ? 'auto' : undefined,
        })}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          {iconNode}
          {wordsNode}
        </div>
        {placeholderBadge}
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      data-element={item.id}
      {...(words.isPlaceholder ? { 'data-export-ignore': 'true' } : {})}
      onClick={handleSlotClick}
      style={boxStyle(item, {
        display: 'flex',
        flexDirection: showIcon ? 'row' : 'column',
        alignItems: showIcon ? 'center' : halign,
        justifyContent: ownsShape ? 'center' : showIcon ? 'flex-start' : valign,
        gap,
        ...spill,
        ...(words.isPlaceholder ? { opacity: 0.45, fontStyle: 'italic' } : {}),
        ...highlightStyle,
        cursor: onSlotClick && item.variable ? 'pointer' : undefined,
        pointerEvents: onSlotClick && item.variable ? 'auto' : undefined,
      })}
    >
      {iconNode}
      {wordsNode}
      {placeholderBadge}
    </div>
  );
});

const ElementBox = memo(function ElementBox(props) {
  const { item, content } = props;
  const isHidden = item?.variable && item?.key && Array.isArray(content?.hiddenSlots) && content.hiddenSlots.includes(item.key);
  if (isHidden) return null;
  return <ElementBoxInner {...props} />;
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
  isEditor = false,
  onImageFail = null,
  isExporting = false,
  showPlaceholders = false,
  highlightSlotKey = null,
  onSlotClick = null,
  isThumbnail = false,
}) {
  const itemNumbers = useMemo(() => computeItemNumbers(elements), [elements]);
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

  /* A picture space with a name of its own has a place in the poster's own values, so only what
     this poster holds under that name may stand there. Spaces with no name of their own still
     take the poster's picture, which is what an event photo has always done. */
  const firstUserImageId = useMemo(() => {
    const list = Array.isArray(elements) ? elements : [];
    const first = list.find(
      (el) =>
        el &&
        el.kind === 'image' &&
        !(el.variable && String(el.key || '').trim()) &&
        !String(el.imageUrl || '').trim()
    );
    return first?.id || null;
  }, [elements]);

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
    isEditor ? 'editor' : 'preview',
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
          isEditor={isEditor}
          isFirstUserSlot={item.id === firstUserImageId}
          onImageFail={onImageFail}
          isExporting={isExporting}
          showPlaceholders={showPlaceholders}
          highlightSlotKey={highlightSlotKey}
          onSlotClick={onSlotClick}
          isThumbnail={isThumbnail}
          numInfo={itemNumbers.get(item.id)}
        />
      ))}
    </>
  );
}
