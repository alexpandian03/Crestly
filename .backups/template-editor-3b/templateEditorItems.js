/**
 * Everything the editor does to a list of items: what a new item looks like, what it is
 * called, how far it may travel, and whether the set may be saved.
 *
 * The save rules are not repeated here - validateElements comes from
 * /shared/templateElements.js, the very same file the API validates with, so the browser
 * never offers a set of items the server would refuse.
 */

import {
  ELEMENT_FIELDS,
  ELEMENT_LIMITS,
  clampRectToArea,
  contentArea,
  normalizeElement,
  normalizeElements,
  plainText,
  validateElements,
} from '../../../shared/templateElements.js';

/** Only the last 50 moves of the item list are kept. */
export const HISTORY_LIMIT = 50;
export const NAME_LIMIT = 120;
export const NOTE_LIMIT = 120;

export const FIELD_LABELS = {
  headline: 'Headline',
  tagline: 'Line under the headline',
  date: 'Date',
  time: 'Time',
  venue: 'Place',
  details: 'Extra lines',
  photo: 'Photo',
};

/** The order the Fields panel lists them in, which is how the poster reads them. */
export const FIELD_ORDER = ELEMENT_FIELDS;

export const TEXT_VARIANTS = {
  heading: {
    label: 'Heading',
    style: { fontFamily: 'Outfit', size: 44, minSize: 18, weight: 700, lineHeight: 1.15 },
    box: { w: 0.8, h: 80 },
  },
  subheading: {
    label: 'Subheading',
    style: { fontFamily: 'Outfit', size: 28, minSize: 14, weight: 500, lineHeight: 1.25 },
    box: { w: 0.7, h: 56 },
  },
  body: {
    label: 'Body text',
    style: { fontFamily: 'Inter', size: 20, minSize: 12, weight: 400, lineHeight: 1.45 },
    box: { w: 0.8, h: 96 },
  },
};

export const TEXT_SAMPLE = {
  heading: 'A heading of your own',
  subheading: 'A smaller line under it',
  body: 'A paragraph of plain words you can change by double-clicking it.',
};

export const SHAPE_VARIANTS = {
  rect: { label: 'Box', box: { w: 260, h: 140 }, shape: { type: 'rect', fill: '#059669' } },
  circle: { label: 'Circle', box: { w: 160, h: 160 }, shape: { type: 'circle', fill: '#f59e0b' } },
  line: { label: 'Line', box: { w: 520, h: 24 }, shape: { type: 'line', fill: '', stroke: '#334155', strokeWidth: 4 } },
};

/** Field items start at a size that suits the poster they are being placed on. */
const FIELD_BOX = {
  headline: { w: 0.9, h: 160, style: { fontFamily: 'Outfit', size: 64, minSize: 24, weight: 700, lineHeight: 1.1 } },
  tagline: { w: 0.7, h: 56, style: { fontFamily: 'Outfit', size: 26, minSize: 14, weight: 500 } },
  date: { w: 0.35, h: 56, style: { fontFamily: 'Inter', size: 22, minSize: 13, weight: 600 } },
  time: { w: 0.35, h: 56, style: { fontFamily: 'Inter', size: 22, minSize: 13, weight: 600 } },
  venue: { w: 0.9, h: 56, style: { fontFamily: 'Inter', size: 22, minSize: 13, weight: 600 } },
  details: { w: 0.9, h: 180, style: { fontFamily: 'Inter', size: 18, minSize: 12, weight: 400, lineHeight: 1.4 } },
  photo: { w: 0.7, h: 300, style: { fit: 'cover', radius: 0 } },
};

/** The rectangle items are allowed to live in, as the brand kit and poster say today. */
export function itemsArea(brandKit, template) {
  return contentArea(brandKit, template);
}

function whole(value) {
  return Math.round(Number(value) || 0);
}

/** A free spot for a new item: stacked down from the top, then wrapped into the area. */
function openSpot(area, count) {
  const step = 28;
  const x = area.x + 40 + ((count % 5) * step);
  const y = area.y + 40 + (Math.floor(count / 5) * step);
  return { x: whole(x), y: whole(y) };
}

function boxIn(area, widthFactor, height) {
  return {
    w: whole(Math.max(ELEMENT_LIMITS.minWidth, Math.min(area.w, widthFactor * area.w))),
    h: whole(Math.max(ELEMENT_LIMITS.minHeight, Math.min(area.h, height))),
  };
}

function place(area, spot, size) {
  return clampRectToArea({ x: spot.x, y: spot.y, w: size.w, h: size.h }, area);
}

function nextId(kind, taken) {
  let n = taken.length + 1;
  const has = (candidate) => taken.some((item) => item.id === candidate);
  let id = `${kind}-${n}`;
  while (has(id)) {
    n += 1;
    id = `${kind}-${n}`;
  }
  return id;
}

function nextZ(items) {
  return items.reduce((top, item) => Math.max(top, whole(item.z)), -1) + 1;
}

/** A field item for the Fields panel; an existing field is never added twice. */
export function newFieldItem(field, items, area) {
  const spec = FIELD_BOX[field] || FIELD_BOX.details;
  const spot = openSpot(area, items.length);
  return normalizeElement(
    {
      id: `field-${field}`,
      kind: 'field',
      field,
      ...place(area, spot, boxIn(area, spec.w, spec.h)),
      z: nextZ(items),
      style: { ...spec.style },
      text: '',
    },
    items.length
  );
}

/** A fixed piece of words the admin types themselves. */
export function newTextItem(variantKey, items, area) {
  const variant = TEXT_VARIANTS[variantKey] || TEXT_VARIANTS.body;
  const spot = openSpot(area, items.length);
  return normalizeElement(
    {
      id: nextId('text', items),
      kind: 'text',
      ...place(area, spot, boxIn(area, variant.box.w, variant.box.h)),
      z: nextZ(items),
      style: { ...variant.style },
      text: variantKey === 'body' ? '' : TEXT_SAMPLE[variantKey] || '',
    },
    items.length
  );
}

/** A picture of the organization's own, from the image library. */
export function newImageItem(items, area, imageUrl = '') {
  const spot = openSpot(area, items.length);
  return normalizeElement(
    {
      id: nextId('photo', items),
      kind: 'image',
      ...place(area, spot, boxIn(area, 0.5, 300)),
      z: nextZ(items),
      style: { fit: 'cover', radius: 0 },
      imageUrl,
    },
    items.length
  );
}

export function newShapeItem(variantKey, items, area) {
  const variant = SHAPE_VARIANTS[variantKey] || SHAPE_VARIANTS.rect;
  const spot = openSpot(area, items.length);
  return normalizeElement(
    {
      id: nextId('shape', items),
      kind: 'shape',
      ...place(area, spot, boxIn(area, variant.box.w / area.w, variant.box.h)),
      z: nextZ(items),
      style: { radius: 0 },
      shape: { ...variant.shape },
    },
    items.length
  );
}

/** Copy an item, shifted so the copy is visible, with its own name. */
export function duplicateItem(item, items, area) {
  const copy = normalizeElement(
    {
      ...item,
      id: nextId(item.kind === 'field' ? `field-${item.field}` : item.kind, items),
      x: item.x + 24,
      y: item.y + 24,
      z: nextZ(items),
      locked: false,
    },
    items.length
  );
  return { ...copy, ...clampRectToArea({ x: copy.x, y: copy.y, w: copy.w, h: copy.h }, area) };
}

/** Can the words on this item be edited where they stand? */
export function isTypedText(item) {
  return item?.kind === 'text';
}

/** Does this item show a picture? */
export function isPicture(item) {
  return item?.kind === 'image' || item?.field === 'photo';
}

/** Does this item show words at all (so the text tools apply)? */
export function hasWords(item) {
  if (!item) return false;
  if (item.kind === 'text') return true;
  if (item.kind === 'field') return item.field !== 'photo';
  return false;
}

/** Every poster keeps its headline, so this one item can never be removed. */
export function isHeadlineItem(item) {
  return item?.kind === 'field' && item?.field === 'headline';
}

/** What screen readers and the Layers list call this item. */
export function itemLabel(item) {
  if (!item) return 'Item';
  if (item.kind === 'field') return FIELD_LABELS[item.field] || item.field;
  if (item.kind === 'text') {
    const words = plainText(item.text, 32);
    return words ? `Text: ${words}` : 'Empty text box';
  }
  if (item.kind === 'image') return item.imageUrl ? 'Photo' : 'Photo, empty';
  const shapeName = { rect: 'Box', circle: 'Circle', line: 'Line' }[item.shape?.type] || 'Shape';
  return shapeName;
}

/**
 * The complete, clean list, in the order it will be saved.
 * Every item is pulled back into today's content area and through the shared rules, so a
 * typed 5000 or a stray key can never leave the browser.
 */
export function cleanItems(items, area) {
  const list = normalizeElements(items);
  return list.map((item) => ({ ...item, ...clampRectToArea({ x: item.x, y: item.y, w: item.w, h: item.h }, area) }));
}

/**
 * The same sentences the API answers with, ready to show the admin.
 * @returns {string[]} empty when the template may be saved
 */
export function problemsFor(items, { brandKit = null, size = null } = {}) {
  const area = brandKit || size ? itemsArea(brandKit, { size }) : null;
  try {
    return validateElements(items, { brandKit, template: size ? { size } : null, area });
  } catch {
    return [];
  }
}

/** Text, compared as words, so a redraw of the same list is not a change. */
export function itemsSignature(items) {
  return JSON.stringify(
    (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      style: item.style,
    }))
  );
}

/** One item, changed and made whole again. */
export function patchItem(item, patch, area) {
  const merged = { ...item, ...patch };
  if (patch.style) {
    merged.style = { ...item.style, ...patch.style };
    /* The smallest size may never be larger than the size that was asked for. */
    if (merged.style.minSize > merged.style.size) merged.style.minSize = merged.style.size;
  }
  if (patch.shape) merged.shape = { ...(item.shape || {}), ...patch.shape };
  const fixed = normalizeElement(merged, 0);
  return { ...fixed, ...clampRectToArea({ x: fixed.x, y: fixed.y, w: fixed.w, h: fixed.h }, area) };
}

/** Move or size one item, kept whole and fully inside the area. */
export function moveItem(item, rect, area) {
  const next = normalizeElement(
    {
      ...item,
      x: whole(rect.x ?? item.x),
      y: whole(rect.y ?? item.y),
      w: Math.max(ELEMENT_LIMITS.minWidth, whole(rect.w ?? item.w)),
      h: Math.max(ELEMENT_LIMITS.minHeight, whole(rect.h ?? item.h)),
    },
    0
  );
  return { ...next, ...clampRectToArea({ x: next.x, y: next.y, w: next.w, h: next.h }, area) };
}

/** Items in the order the Layers panel shows them: top of the poster first. */
export function layersOf(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.z - a.item.z || b.index - a.index)
    .map(({ item }) => item);
}
