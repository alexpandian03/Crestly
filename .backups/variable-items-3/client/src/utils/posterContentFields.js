import { ELEMENT_LIMITS } from '../../../shared/templateElements.js';
import { resolveTemplateRender, templateElements, usesTemplateElements } from './templateRender.js';

/* ------------------------------------------------------------------ *
 * The words a poster shows, and what may be done to them on the Create page.
 *
 * The same six pieces of writing the side form edits, named the same way, with the
 * same character limits the save rules accept. Nothing here talks to the server: a
 * poster's own words are the only thing a user may change.
 * ------------------------------------------------------------------ */

/** Mirrors the content limits the API saves with. */
export const CONTENT_LIMITS = {
  title: 60,
  tagline: 100,
  date: 30,
  time: 20,
  venue: 80,
  detail: 90,
  maxDetails: 4,
};

export const LOCKED_MESSAGE = 'Locked by your organization';

/** Every word group a poster can carry, in the order the poster reads them. */
export const POSTER_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details', 'photo'];

export const FIELD_LABELS = {
  headline: 'Headline',
  tagline: 'Line under the headline',
  date: 'Date',
  time: 'Time',
  venue: 'Place',
  details: 'Extra lines',
  photo: 'Photo',
};

/** The poster's own writing, so a photo never gets mistaken for words. */
export const TEXT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details'];

const FIELD_TO_KEY = {
  headline: 'title',
  tagline: 'tagline',
  date: 'date',
  time: 'time',
  venue: 'venue',
  details: 'details',
  photo: 'imageUrl',
};

/** 'description' is the name the layout uses for the line under the headline. */
export function normalizeFieldName(name) {
  if (name === 'description') return 'tagline';
  return POSTER_FIELDS.includes(name) ? name : '';
}

export function contentKeyOf(field) {
  return FIELD_TO_KEY[field] || '';
}

export function limitOf(field) {
  if (field === 'details') return CONTENT_LIMITS.detail * CONTENT_LIMITS.maxDetails;
  return CONTENT_LIMITS[contentKeyOf(field)] || CONTENT_LIMITS.tagline;
}

/** Control characters and line breaks that would break the saved words are dropped. */
function plain(value) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ');
}

/** The words one field shows, as text an editor can type into. */
export function wordsOf(content, field) {
  if (!content) return '';
  if (field === 'details') {
    const lines = Array.isArray(content.details) ? content.details : content.details ? [content.details] : [];
    return lines.map((line) => plain(line).trim()).filter(Boolean).slice(0, CONTENT_LIMITS.maxDetails).join('\n');
  }
  if (field === 'photo') return '';
  return plain(content[contentKeyOf(field)]).trim();
}

/** The same text, split back into the poster's own shape. */
export function linesOf(text, field) {
  const max = limitOf(field);
  if (field !== 'details') {
    const one = plain(text).replace(/\s*\n\s*/g, ' ').trim().slice(0, max);
    return one ? [one] : [];
  }
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => plain(line).trim().slice(0, CONTENT_LIMITS.detail))
    .filter(Boolean)
    .slice(0, CONTENT_LIMITS.maxDetails);
  const room = lines.reduce((sum, line) => sum + line.length, 0);
  if (room > max) {
    // Keep the total inside the same window the save rules accept.
    return lines.map((line) => line.slice(0, Math.max(1, max - room + line.length))).filter(Boolean);
  }
  return lines;
}

/** A new content object with one field replaced; every other word is kept. */
export function withFieldWords(content, field, text) {
  const base = content || {};
  if (field === 'details') {
    return { ...base, details: linesOf(text, 'details') };
  }
  return { ...base, [contentKeyOf(field)]: linesOf(text, field)[0] ?? '' };
}

export function photoUrlOf(content) {
  return String(content?.imageUrl || content?.image || '').trim();
}

/** The empty starting point for the size and photo-shape changes a user makes here. */
export function emptyView() {
  return { sizes: {}, wholeMax: null, photoFit: null };
}

function sameView(a, b) {
  if (a === b) return true;
  const left = a || emptyView();
  const right = b || emptyView();
  if (left.wholeMax !== right.wholeMax || left.photoFit !== right.photoFit) return false;
  const keys = Object.keys(left.sizes || {});
  const other = Object.keys(right.sizes || {});
  if (keys.length !== other.length) return false;
  return keys.every((key) => left.sizes[key] === right.sizes[key]);
}

export const viewsEqual = sameView;

export function withFieldSize(view, field, size) {
  const sizes = { ...(view?.sizes || {}) };
  if (size == null) delete sizes[field];
  else sizes[field] = Math.round(size);
  return { sizes, wholeMax: view?.wholeMax ?? null, photoFit: view?.photoFit ?? null };
}

export function withWholeMax(view, size) {
  return {
    sizes: { ...(view?.sizes || {}) },
    wholeMax: size == null ? null : Math.round(size),
    photoFit: view?.photoFit ?? null,
  };
}

export function withPhotoFit(view, fit) {
  const next = fit === 'contain' || fit === 'cover' ? fit : null;
  return {
    sizes: { ...(view?.sizes || {}) },
    wholeMax: view?.wholeMax ?? null,
    photoFit: next,
  };
}

/**
 * How big these words may be, and how big they are right now.
 *
 * A template that carries placed items gives every group its own chosen size and its
 * own smallest readable size, so the stepper runs between those two. An older layout
 * sizes the whole text column at once, so the stepper runs between the template's own
 * smallest and largest text and applies to every line.
 */
export function sizeRangeOf(template, brandKit, field) {
  const rendered = resolveTemplateRender(template);
  const step = 2;
  if (usesTemplateElements(template)) {
    const item = templateElements(template, brandKit).find((each) => each.kind === 'field' && each.field === field);
    if (item) {
      const chosen = clampFont(item.style.size);
      const smallest = clampFont(Math.min(item.style.minSize, item.style.size));
      return { mode: 'field', lo: Math.min(smallest, chosen), hi: Math.max(smallest, chosen), step, current: chosen };
    }
  }
  const hi = Math.max(rendered.fonts.minFont, Math.min(rendered.fonts.maxFont, columnCeiling(rendered)));
  return { mode: 'whole', lo: rendered.fonts.minFont, hi, step, current: hi };
}

/* An older layout sizes the whole text column with one auto-fit that the renderer tops
 * at 1.12 units, one unit being this column's own details size, so a declared maximum
 * above that is unreachable. Offering it would be a stepper that does nothing. */
const FIT_UNIT_MAX = 1.12;
const DETAILS_PX = 32;
const REF_ZONE_W = 940;
const REF_ZONE_H = 1080;

function columnCeiling(rendered) {
  const zone = rendered.zones?.content;
  const unitK = zone?.w && zone?.h
    ? Math.min(Math.max(Math.min(zone.w / REF_ZONE_W, zone.h / REF_ZONE_H), 0.45), 3)
    : 1;
  return Math.floor(FIT_UNIT_MAX * DETAILS_PX * unitK);
}

function clampFont(value) {
  const n = Math.round(Number(value) || 0);
  if (!n) return ELEMENT_LIMITS.fontSize.min;
  return Math.min(ELEMENT_LIMITS.fontSize.max, Math.max(ELEMENT_LIMITS.fontSize.min, n));
}

/** The current size of one field, taking the user's change into account. */
export function currentSizeOf(view, range, field) {
  if (range.mode === 'field') {
    const override = view?.sizes?.[field];
    return Number.isFinite(override) ? override : range.current;
  }
  return Number.isFinite(view?.wholeMax) ? view.wholeMax : range.current;
}

export function clampSize(range, value) {
  return Math.min(range.hi, Math.max(range.lo, Math.round(Number(value) || range.current)));
}

/** True when anything the user changed is still on screen. */
export function viewIsDirty(view) {
  const clean = view || emptyView();
  return Boolean(Object.keys(clean.sizes || {}).length || clean.wholeMax != null || clean.photoFit);
}
