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
  VARIABLE_LIMITS,
  checkElementImageUrl,
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

export const ITEM_MODES = {
  locked: 'Locked',
  ai: 'AI fills it, users can edit',
  user: 'Users replace it',
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

/* ------------------------------------------------------------- fill-ins */

/** The plain first 30 characters of some words, which is how a fill-in is shown. */
export function labelFromWords(words) {
  return plainText(words, VARIABLE_LIMITS.labelChars).trim();
}

/** What the assistant is told to write when the admin did not say anything else. */
export function defaultHint(label) {
  return plainText(`Write this from the user's description: ${label}`, VARIABLE_LIMITS.hintChars);
}

/** The name a new fill-in carries until the admin writes its own words. */
export const AI_TEXT_START = {
  heading: 'Heading',
  subheading: 'Small line',
  body: 'Short line',
};

/** A photo blank is numbered, so a template with three of them never reads the same twice. */
export function photoSlotLabel(items) {
  return plainText(`Photo space ${userImageCount(items) + 1}`, VARIABLE_LIMITS.labelChars);
}

function keySeed(label) {
  const slug = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, VARIABLE_LIMITS.key.max);
  return slug || 'slot';
}

/** A fill-in name nobody else on this template already uses. */
export function uniqueKey(label, items, exceptId = '') {
  const taken = new Set(
    (Array.isArray(items) ? items : [])
      .filter((item) => item?.variable && item.id !== exceptId)
      .map((item) => item.key)
  );
  const base = keySeed(label);
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    const tail = `_${n}`;
    candidate = `${base.slice(0, Math.max(1, VARIABLE_LIMITS.key.max - tail.length))}${tail}`;
    n += 1;
  }
  return candidate;
}

/** A copy is named after the original, so "<label> copy" with room left for the word copy. */
export function copyLabel(label) {
  const base = plainText(label, VARIABLE_LIMITS.labelChars - 5).trim();
  return `${base ? `${base} ` : ''}copy`.slice(0, VARIABLE_LIMITS.labelChars);
}

export function aiTextCount(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.kind === 'text' && item?.variable).length;
}

export function userImageCount(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.kind === 'image' && item?.variable).length;
}

export function isAiText(item) {
  return item?.kind === 'text' && Boolean(item?.variable);
}

export function isUserImage(item) {
  return item?.kind === 'image' && Boolean(item?.variable);
}

/** How many fill-ins the template holds, in the words the panels and the toolbar show. */
export function counterLine(items) {
  const texts = aiTextCount(items);
  const images = userImageCount(items);
  return {
    texts: `${texts} of ${VARIABLE_LIMITS.maxText} AI texts`,
    images: `${images} of ${VARIABLE_LIMITS.maxImage} user images`,
    fullTexts: texts >= VARIABLE_LIMITS.maxText,
    fullImages: images >= VARIABLE_LIMITS.maxImage,
  };
}

/** Said out loud when a limit stops a new item from being a fill-in. */
export const LIMIT_MESSAGES = {
  text: `This template already has ${VARIABLE_LIMITS.maxText} texts the assistant fills in, which is the most it can hold, so the new box is fixed words of your own.`,
  image: `This template already has ${VARIABLE_LIMITS.maxImage} photos a person replaces, which is the most it can hold, so the new space keeps the picture you put in it.`,
};

/** Locked | AI fills it, users can edit | Users replace it. */
export function modeOf(item) {
  if (isAiText(item)) return 'ai';
  if (isUserImage(item)) return 'user';
  return 'locked';
}

/**
 * One item, put into one mode. An AI text keeps its words as the name shown for the blank,
 * so the box on the canvas always reads what the blank is for.
 */
export function setItemMode(item, items, mode, area) {
  const kind = item?.kind;
  const merged = { ...item };
  const wantsVariable = (mode === 'ai' && kind === 'text') || (mode === 'user' && kind === 'image');
  if (!wantsVariable) {
    /* The shared rules drop every fill-in field from an item that is not one. */
    merged.variable = false;
  } else {
    const fallback = kind === 'image' ? 'Photo' : 'Text';
    const label = labelFromWords(merged.label || merged.text) || fallback;
    merged.variable = true;
    merged.label = label;
    merged.key = uniqueKey(label, items, item.id);
    merged.hint = kind === 'text' ? plainText(merged.hint || defaultHint(label), VARIABLE_LIMITS.hintChars) : '';
    if (kind === 'text') {
      merged.maxLength = Math.min(
        VARIABLE_LIMITS.maxLength.max,
        Math.max(VARIABLE_LIMITS.maxLength.min, whole(merged.maxLength) || VARIABLE_LIMITS.maxLength.default)
      );
      if (!plainText(merged.text).trim()) merged.text = label;
    }
  }
  const fixed = normalizeElement(merged, 0);
  return { ...fixed, ...clampRectToArea({ x: fixed.x, y: fixed.y, w: fixed.w, h: fixed.h }, area) };
}

/**
 * A copy or a pasted item that would push the template past the number of blanks it can
 * hold is placed as a fixed item instead, and the reason is said out loud.
 */
export function keepWithinLimits(incoming, list, area) {
  let soFar = Array.isArray(list) ? list : [];
  const out = [];
  let reason = '';
  (Array.isArray(incoming) ? incoming : []).forEach((item) => {
    let placed = item;
    if (isAiText(item) && aiTextCount(soFar) >= VARIABLE_LIMITS.maxText) {
      placed = setItemMode(item, soFar, 'locked', area);
      reason = reason || LIMIT_MESSAGES.text;
    } else if (isUserImage(item) && userImageCount(soFar) >= VARIABLE_LIMITS.maxImage) {
      placed = setItemMode(item, soFar, 'locked', area);
      reason = reason || LIMIT_MESSAGES.image;
    }
    out.push(placed);
    soFar = [...soFar, placed];
  });
  return { items: out, reason };
}

/**
 * The name, hint or room of a fill-in, changed and made whole again. The name travels with
 * its own key, which is handed out again against every other fill-in on the template.
 */
export function setItemMeta(item, items, patch, area) {
  const merged = { ...item, ...patch };
  if (patch.label !== undefined) {
    merged.label = labelFromWords(patch.label) || item.label || (item.kind === 'image' ? 'Photo' : 'Text');
    merged.key = uniqueKey(merged.label, items, item.id);
    /* A hint nobody wrote still follows the name; a written one keeps its own words. */
    const untouched = !merged.hint || merged.hint === defaultHint(item.label || '');
    merged.hint = item.kind === 'text' ? (untouched ? defaultHint(merged.label) : plainText(merged.hint, VARIABLE_LIMITS.hintChars)) : '';
  }
  const fixed = normalizeElement(merged, 0);
  return { ...fixed, ...clampRectToArea({ x: fixed.x, y: fixed.y, w: fixed.w, h: fixed.h }, area) };
}

/**
 * Long words, or words that end like a sentence, are almost certainly part of the design
 * rather than a blank somebody fills in later.
 */
export function looksLikeFixedText(words) {
  const trimmed = String(words || '').trim();
  if (!trimmed) return false;
  if (trimmed.length > VARIABLE_LIMITS.labelChars) return true;
  return /[.!?]["'”’)\]]*$/.test(trimmed);
}

export const FIXED_TEXT_WARNING =
  'This looks like fixed text. Switch it to Locked, or shorten it to a name like Chief guest.';

/** A box of your own words that has not been written yet: empty, or still the sample it came with. */
const PRESET_WORDS = new Set([...Object.values(TEXT_SAMPLE), ...Object.values(AI_TEXT_START)]);

export function fixedTextProblems(items) {
  const problems = [];
  const said = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (item?.kind !== 'text' || item.variable) return;
    const words = plainText(item.text).trim();
    const line = !words
      ? 'A text box has no words in it, so it would print nothing. Type them, or make it one the assistant fills in.'
      : PRESET_WORDS.has(words)
      ? `A text box still holds the words it came with ("${words}"). Write your own, or make it one the assistant fills in.`
      : '';
    if (line && !said.has(line)) {
      said.add(line);
      problems.push(line);
    }
  });
  return problems;
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

/**
 * A piece of words from the Text panel. It starts as one the assistant fills in, so the
 * admin only has to write its name; when the template already holds the most fill-ins it
 * can, the caller asks for a locked one instead and says why.
 */
export function newTextItem(variantKey, items, area, { variable = true } = {}) {
  const variant = TEXT_VARIANTS[variantKey] || TEXT_VARIANTS.body;
  const spot = openSpot(area, items.length);
  const fresh = normalizeElement(
    {
      id: nextId('text', items),
      kind: 'text',
      ...place(area, spot, boxIn(area, variant.box.w, variant.box.h)),
      z: nextZ(items),
      style: { ...variant.style },
      text: variable ? AI_TEXT_START[variantKey] || '' : variantKey === 'body' ? '' : TEXT_SAMPLE[variantKey] || '',
    },
    items.length
  );
  if (!variable) return fresh;
  return setItemMode({ ...fresh, label: AI_TEXT_START[variantKey] || '' }, items, 'ai', area);
}

/**
 * A picture space from the Images panel. It starts as one the person replacing the photo
 * fills in, with nothing in it, so the poster shows a blank until they choose one.
 */
export function newImageItem(items, area, imageUrl = '', { variable = true } = {}) {
  const spot = openSpot(area, items.length);
  const fresh = normalizeElement(
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
  if (!variable) return fresh;
  return setItemMode({ ...fresh, label: photoSlotLabel(items) }, items, 'user', area);
}

/**
 * The words typed into a fill-in become its name, so the blank on the poster, the name the
 * assistant is asked for and the Layers row all say the same thing.
 */
export function commitItemText(item, items, words, area) {
  const text = plainText(words, ELEMENT_LIMITS.textChars);
  if (!item?.variable || item.kind !== 'text') return patchItem(item, { text }, area);
  const merged = { ...item, text, label: labelFromWords(text) || item.label };
  merged.key = uniqueKey(merged.label, items, item.id);
  /* Erasing the box leaves the name standing in it, which is what a blank is for. */
  if (!merged.text.trim()) merged.text = merged.label;
  /* Only a hint nobody touched follows the new name; a written one stays. */
  const untouched = !merged.hint || merged.hint === defaultHint(item.label || '');
  merged.hint = untouched ? defaultHint(merged.label) : plainText(merged.hint, VARIABLE_LIMITS.hintChars);
  const fixed = normalizeElement(merged, 0);
  return { ...fixed, ...clampRectToArea({ x: fixed.x, y: fixed.y, w: fixed.w, h: fixed.h }, area) };
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

/** Copy an item, shifted so the copy is visible, with its own name and its own mode. */
export function duplicateItem(item, items, area) {
  const copy = {
    ...item,
    id: nextId(item.kind === 'field' ? `field-${item.field}` : item.kind, items),
    x: item.x + 24,
    y: item.y + 24,
    z: nextZ(items),
    locked: false,
  };
  if (copy.variable) {
    copy.label = copyLabel(copy.label || copy.text);
    copy.key = uniqueKey(copy.label, items);
    /* A copied blank asks for the same thing the first one did, in its own words. */
    if (copy.kind === 'text') copy.text = copy.label;
  }
  const fixed = normalizeElement(copy, items.length);
  return { ...fixed, ...clampRectToArea({ x: fixed.x, y: fixed.y, w: fixed.w, h: fixed.h }, area) };
}

/* ------------------------------------------------------------- clipboard */

/** One paste in this browser tab: the items only, never a whole template. */
export const CLIPBOARD_KEY = 'poster-template-clipboard';
export const CLIPBOARD_MAX = 10;

export const CLIPBOARD_EMPTY = 'There is nothing to put back yet. Pick an item and copy it first.';

/**
 * Puts the selected item on the small clipboard. Only the shared item shape is kept, so a
 * stray key or an id from another template can never travel with it.
 * @returns {number} how many items are now on the clipboard
 */
export function writeClipboard(item) {
  const list = normalizeElements(item ? [item] : []).slice(0, CLIPBOARD_MAX);
  try {
    if (!list.length) window.sessionStorage.removeItem(CLIPBOARD_KEY);
    else window.sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(list));
  } catch {
    /* private mode or a full store: copying simply does nothing. */
  }
  return list.length;
}

/**
 * The clipboard, read back as items that may be placed on this template. Every picture is
 * checked against the same hosts the save rules accept, and names are handed out again
 * against the items already here, so a paste can never collide or smuggle a foreign photo.
 * @returns {{ items: object[], problem: string }}
 */
export function readClipboard(items, area, { clientId = '' } = {}) {
  let raw = '';
  try {
    raw = window.sessionStorage.getItem(CLIPBOARD_KEY) || '';
  } catch {
    return { items: [], problem: 'This browser will not let the editor remember a copy.' };
  }
  if (!raw.trim()) return { items: [], problem: CLIPBOARD_EMPTY };

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], problem: 'The copied item could not be read. Copy it again.' };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { items: [], problem: 'The copied item could not be read. Copy it again.' };
  }

  const pasted = [];
  for (const sent of parsed.slice(0, CLIPBOARD_MAX)) {
    if (!sent || typeof sent !== 'object' || Array.isArray(sent)) {
      return { items: [], problem: 'The copied item is not something this editor can place.' };
    }
    const url = typeof sent.imageUrl === 'string' ? sent.imageUrl.trim() : '';
    if (url) {
      const check = checkElementImageUrl(url, { clientId });
      if (!check.ok) return { items: [], problem: `The copied photo cannot come here. ${check.reason}` };
    }
    pasted.push(normalizeElement(sent, 0));
  }

  const placed = pasted.map((item, index) => {
    const soFar = [...(Array.isArray(items) ? items : []), ...pasted.slice(0, index)];
    const fresh = { ...item, id: nextId(item.kind === 'field' ? `field-${item.field}` : item.kind, soFar), locked: false };
    if (fresh.variable) {
      /* Put back on the same poster it came from, it asks for the same thing under a new name. */
      const sameName = soFar.some((each) => each.variable && (each.label || '') === (fresh.label || ''));
      if (sameName) {
        fresh.label = copyLabel(fresh.label || fresh.key);
        if (fresh.kind === 'text') fresh.text = fresh.label;
      }
      fresh.key = uniqueKey(fresh.label || fresh.key, soFar);
    }
    const shifted = { ...fresh, x: fresh.x + 24, y: fresh.y + 24, z: nextZ(soFar) };
    const fixed = normalizeElement(shifted, soFar.length);
    return { ...fixed, ...clampRectToArea({ x: fixed.x, y: fixed.y, w: fixed.w, h: fixed.h }, area) };
  });

  return { items: placed, problem: '' };
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

/** How many of the items carry a picture of their own; a photo field is the poster's. */
export function pictureCountOf(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item.kind === 'image').length;
}

/**
 * Put one item at another place in the stack and hand the stacking numbers out again from
 * the bottom up, so no two items share one. The list is top-first, like the panel.
 */
function renumberByTopFirst(items, topFirst) {
  const zById = new Map(topFirst.slice().reverse().map((id, position) => [id, position]));
  return (Array.isArray(items) ? items : []).map((item) => {
    const z = zById.get(item.id);
    return z === undefined || z === item.z ? item : { ...item, z };
  });
}

/** Move one item up (delta 1) or down (delta -1) through the stack, top-first. */
export function shiftLayer(items, movingId, delta) {
  const list = Array.isArray(items) ? items : [];
  const topFirst = layersOf(list).map((item) => item.id);
  const from = topFirst.indexOf(movingId);
  if (from < 0) return list;
  const to = Math.min(topFirst.length - 1, Math.max(0, from - (Number(delta) || 0)));
  if (to === from) return list;
  topFirst.splice(from, 1);
  topFirst.splice(to, 0, movingId);
  return renumberByTopFirst(list, topFirst);
}

/** Drop one item where another one sits, which is what dragging in the panel does. */
export function setLayerOrder(items, movingId, targetId) {
  const list = Array.isArray(items) ? items : [];
  if (!movingId || movingId === targetId) return list;
  const topFirst = layersOf(list).map((item) => item.id);
  const from = topFirst.indexOf(movingId);
  const to = topFirst.indexOf(targetId);
  if (from < 0 || to < 0) return list;
  topFirst.splice(from, 1);
  topFirst.splice(Math.min(to, topFirst.length), 0, movingId);
  return renumberByTopFirst(list, topFirst);
}
