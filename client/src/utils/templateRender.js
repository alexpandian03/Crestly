/**
 * Turns a template into render values for <PosterCanvas>.
 *
 * Mirrors server/services/template/zones.js (LAYOUT_BASE, LAYOUT_OPTIONS,
 * FONT_DEFAULTS, TEMPLATE_SIZE_DEFAULT) on the client. Every field is optional,
 * so templates saved before the layout block existed fall back to the defaults
 * and keep rendering the way they always did.
 *
 * The item rules themselves are not mirrored here: they are imported from
 * /shared/templateElements.js, the very same file the API validates with.
 */

import {
  EDITOR_VERSION,
  contentArea,
  legacyToElements,
  normalizeElements,
  resolveStyleTokens,
} from '../../../shared/templateElements.js';
import { blendOver, contrastRatio, parseColor, pickReadableColor } from './contrast.js';

export const TEMPLATE_SIZE_DEFAULT = { width: 1080, height: 1350 };

export const LAYOUT_BASE = {
  alignment: 'left',
  spacing: 'normal',
  imagePlacement: 'none',
  infoStyle: 'stacked',
  decoration: 'none',
};

export const LAYOUT_OPTIONS = {
  alignment: ['left', 'center'],
  spacing: ['compact', 'normal', 'relaxed'],
  imagePlacement: ['top', 'middle', 'bottom', 'none'],
  infoStyle: ['card', 'inline', 'stacked'],
  decoration: ['none', 'band', 'circle'],
};

export const FONT_DEFAULTS = { minFont: 12, maxFont: 48 };
export const TEMPLATE_CATEGORIES = ['Event', 'Festival', 'Awareness', 'Achievement', 'Notice', 'Custom'];

/**
 * The word groups the builder can nudge one by one, in the order the poster reads them.
 * Mirrors LAYOUT_ITEM_KEYS on the server; each key stores { dx, dy } in poster pixels.
 */
export const LAYOUT_ITEM_KEYS = ['headline', 'description', 'date', 'time', 'venue', 'details'];

export const ITEM_OFFSET_DEFAULT = { dx: 0, dy: 0 };
export const ITEM_OFFSET_LIMIT = 4000;

/** Plain-word names, matching the words the edit panel uses for the same words. */
export const ITEM_LABELS = {
  headline: 'Headline',
  description: 'Line under the headline',
  date: 'Date',
  time: 'Time',
  venue: 'Place',
  details: 'Extra lines',
};

/** Gap multiplier for the three spacing steps. */
const SPACING_FACTOR = { compact: 0.72, normal: 1, relaxed: 1.32 };

const numberOr = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pick = (value, options, fallback) => (options.includes(value) ? value : fallback);

const clampInt = (value, lo, hi, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

const clampOffset = (value) => clampInt(value, -ITEM_OFFSET_LIMIT, ITEM_OFFSET_LIMIT, 0);

/**
 * Every word nudge, complete and whole, in the same key order on every path, so two
 * working copies can be compared as text. Mirrors normalizeItemOffsets on the server.
 */
export function normalizeItemOffsets(offsets) {
  const clean = {};
  for (const key of LAYOUT_ITEM_KEYS) {
    clean[key] = { dx: clampOffset(offsets?.[key]?.dx), dy: clampOffset(offsets?.[key]?.dy) };
  }
  return clean;
}

function zoneRect(zone, canvas) {
  return {
    x: clampInt(zone.x, 0, canvas.width, 0),
    y: clampInt(zone.y, 0, canvas.height, 0),
    w: Math.max(1, clampInt(zone.w, 1, canvas.width, 1)),
    h: Math.max(1, clampInt(zone.h, 1, canvas.height, 1)),
  };
}

export function templateIdOf(template) {
  return String(template?.id || template?._id || '');
}

/** Normalised template size, e.g. { width: 1080, height: 1350 }. */
export function resolveTemplateSize(template) {
  return {
    width: clampInt(template?.size?.width, 200, 4000, TEMPLATE_SIZE_DEFAULT.width),
    height: clampInt(template?.size?.height, 200, 4000, TEMPLATE_SIZE_DEFAULT.height),
  };
}

/**
 * @returns {{size: {width: number, height: number}, layout: object, zones: object}}
 * layout carries the five declared fields, the six word nudges and derived render
 * numbers; zones carries the content / image / header / footer rectangles (image is
 * null when the template has no photo area or the layout turns it off).
 */
export function resolveTemplateRender(template) {
  const size = resolveTemplateSize(template);
  const rawZones = Array.isArray(template?.zones) ? template.zones : [];
  const zoneOf = (type) => rawZones.find((z) => z?.type === type) || null;

  const header = zoneOf('header');
  const footer = zoneOf('footer');
  const contentZone = zoneOf('content');
  const imageZone = zoneOf('image');

  const base = { ...LAYOUT_BASE, imagePlacement: imageZone ? 'middle' : LAYOUT_BASE.imagePlacement };
  const raw = template?.layout || {};
  const layout = {
    alignment: pick(raw.alignment, LAYOUT_OPTIONS.alignment, base.alignment),
    spacing: pick(raw.spacing, LAYOUT_OPTIONS.spacing, base.spacing),
    imagePlacement: pick(raw.imagePlacement, LAYOUT_OPTIONS.imagePlacement, base.imagePlacement),
    infoStyle: pick(raw.infoStyle, LAYOUT_OPTIONS.infoStyle, base.infoStyle),
    decoration: pick(raw.decoration, LAYOUT_OPTIONS.decoration, base.decoration),
  };

  const content = contentZone
    ? zoneRect(contentZone, size)
    : { x: Math.round(size.width * 0.065), y: header ? numberOr(header.h, 140) : Math.round(size.height * 0.12), w: Math.round(size.width * 0.87), h: Math.round(size.height * 0.66) };

  const showImage = layout.imagePlacement !== 'none' && Boolean(imageZone);
  const image = showImage ? zoneRect(imageZone, size) : null;
  /* A template that has a photo area and turns it off shows no photo at all. */
  const hidePhoto = Boolean(imageZone) && layout.imagePlacement === 'none';

  const fonts = {
    minFont: clampInt(contentZone?.minFont, 8, 200, FONT_DEFAULTS.minFont),
    maxFont: clampInt(contentZone?.maxFont, 8, 200, FONT_DEFAULTS.maxFont),
  };
  if (fonts.maxFont < fonts.minFont) fonts.maxFont = fonts.minFont;

  return {
    size,
    layout: {
      ...layout,
      itemOffsets: normalizeItemOffsets(raw.itemOffsets),
      spacingFactor: SPACING_FACTOR[layout.spacing],
      centerColumn: layout.alignment === 'center',
      hidePhoto,
    },
    fonts,
    zones: {
      content,
      image,
      header: header ? zoneRect(header, size) : null,
      footer: footer ? zoneRect(footer, size) : null,
    },
  };
}

/** True when the photo sits inside the text column instead of its own band. */
export function imageInsideContent(image, content) {
  if (!image || !content) return false;
  return image.y >= content.y - 2 && image.y + image.h <= content.y + content.h + 2;
}

/**
 * Does this template draw the items the editor placed, or the classic flow layout?
 * Only templates that carry items of their own take the new path, so every template
 * and every poster snapshot saved before the editor keeps exactly its old look.
 */
export function usesTemplateElements(template) {
  return (
    Number(template?.editorVersion) === EDITOR_VERSION &&
    Array.isArray(template?.elements) &&
    template.elements.length > 0
  );
}

/**
 * The items to draw, in the order the poster stacks them. A template that says it was
 * made by the editor but carries no items of its own (an older poster snapshot, for
 * instance) is read from its areas instead, so nothing ever draws an empty poster.
 *
 * Every item is then clamped into the content area as it is TODAY. A brand kit whose
 * header or footer got taller since the template was saved would otherwise clip words
 * away; the saved numbers are never changed, only what is drawn.
 */
export function templateElements(template, brandKit) {
  const stored = Array.isArray(template?.elements) ? template.elements : [];
  const items = (stored.length > 0 ? normalizeElements(stored) : legacyToElements(template, brandKit))
    .map((item) => resolveStyleTokens(item, brandKit));
  return items.map((item) => clampItemToArea(item, contentArea(brandKit, template)));
}

/** The same box, moved and shrunk so it sits inside `area`. */
function clampItemToArea(item, area) {
  if (!area || area.w <= 0 || area.h <= 0) return item;
  const w = Math.min(item.w, area.w);
  const h = Math.min(item.h, area.h);
  const x = Math.min(Math.max(item.x, area.x), area.x + area.w - w);
  const y = Math.min(Math.max(item.y, area.y), area.y + area.h - h);
  if (x === item.x && y === item.y && w === item.w && h === item.h) return item;
  return { ...item, x, y, w, h };
}

/* ------------------------------------------------------------------------- *
 * Reading what is placed
 *
 * A design chooses one colour per item, but the colour behind those words is not
 * always the one the design meant: a pill, a button plate or the poster's own
 * background sits under them. So the drawn colour is checked against the real
 * backdrop and exchanged for a readable brand colour when it would be hard to read.
 * ------------------------------------------------------------------------- */

/** The same bar the brand form calls readable. */
export const ITEM_CONTRAST_MIN = 4.5;

const WORD_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details'];

function drawsWords(item) {
  if (!item) return false;
  if (item.kind === 'text') return true;
  return item.kind === 'field' && WORD_FIELDS.includes(item.field);
}

/** `outer` holds `inner` completely, allowing a pixel or two of rounding. */
function covers(outer, inner, tolerance = 2) {
  return (
    outer.x - tolerance <= inner.x &&
    outer.y - tolerance <= inner.y &&
    outer.x + outer.w + tolerance >= inner.x + inner.w &&
    outer.y + outer.h + tolerance >= inner.y + inner.h
  );
}

function isPlate(item) {
  return item?.kind === 'shape' && item?.shape?.type !== 'line' && Boolean(item?.shape?.fill);
}

/**
 * The shape each item's words stand on, by item id: the topmost filled shape that holds
 * the whole box. Words over nothing read from the poster's own background instead.
 */
export function platesUnder(items) {
  const list = Array.isArray(items) ? items : [];
  const plates = list.filter(isPlate);
  const found = new Map();
  if (plates.length === 0) return found;
  for (const item of list) {
    if (!drawsWords(item)) continue;
    let best = null;
    for (const plate of plates) {
      if (plate === item || !(plate.z < item.z) || !covers(plate, item)) continue;
      if (!best || best.z < plate.z) best = plate;
    }
    if (best) found.set(item.id, best);
  }
  return found;
}

/** True when the words fill their shape instead of sharing it - a button, not a cell. */
export function ownsPlate(item, plate, tolerance = 4) {
  if (!item || !plate) return false;
  return (
    Math.abs(plate.x - item.x) <= tolerance &&
    Math.abs(plate.y - item.y) <= tolerance &&
    Math.abs(plate.w - item.w) <= tolerance &&
    Math.abs(plate.h - item.h) <= tolerance
  );
}

/** The colour really behind an item's words, with a see-through plate painted in. */
export function itemBackdrop(item, plate, surface) {
  if (!plate) return surface;
  const rgb = parseColor(plate.shape?.fill);
  if (!rgb) return surface;
  const opacity = Number(plate.style?.opacity);
  const strength = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1;
  const a = rgb.a * strength;
  const fill = a >= 1 ? plate.shape.fill : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  return blendOver(fill, surface || '#ffffff');
}

/** What a report line calls an item. */
function itemName(item) {
  return item.name || item.label || item.field || item.key || item.id || 'item';
}

/**
 * Every item, with its own colour kept whenever it reads against what is actually behind
 * it and exchanged for the best of the brand's readable colours when it does not. Also
 * answers the switches it made, in plain numbers, so a check page can report them.
 */
export function readableItems(items, { surface = '', candidates = [] } = {}) {
  const plates = platesUnder(items);
  const list = Array.isArray(items) ? items : [];
  const switched = [];
  const next = list.map((item) => {
    if (!drawsWords(item)) return item;
    const plate = plates.get(item.id) || null;
    const backdrop = itemBackdrop(item, plate, surface);
    const ratio = contrastRatio(item.style?.color, backdrop);
    if (ratio === null || ratio >= ITEM_CONTRAST_MIN) return item;
    const color = pickReadableColor([item.style?.color, ...candidates], backdrop, ITEM_CONTRAST_MIN);
    if (!color || color === item.style.color) return item;
    switched.push({
      id: item.id,
      name: itemName(item),
      from: item.style.color,
      to: color,
      ratio: Math.round(ratio * 100) / 100,
      on: plate ? 'shape' : 'poster background',
      backdrop,
    });
    return { ...item, style: { ...item.style, color } };
  });
  return { items: next, switched };
}
