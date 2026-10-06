/**
 * Builder rules for the template editor.
 *
 * Mirrors server/services/template/zones.js (same numbers, plain words) plus the
 * snapping the canvas uses, so an arrangement that looks right on screen is the
 * arrangement the server accepts.
 */

import {
  FONT_DEFAULTS,
  LAYOUT_BASE,
  LAYOUT_OPTIONS,
  TEMPLATE_CATEGORIES,
  resolveTemplateSize,
} from './templateRender';

export const GRID_STEP = 10;

export const POSTER_LIMITS = {
  minWidth: 600,
  maxWidth: 2400,
  minHeight: 600,
  maxHeight: 3200,
};

export const MIN_AREA_SIZE = { width: 120, height: 80 };
export const MIN_TEXT_COVERAGE = 0.4;
export const MAX_AREAS = 6;
export const TEXT_SIZE_RANGE = { min: 10, max: 200 };
export const NAME_LIMIT = 120;
export const NOTE_LIMIT = 120;
export const HISTORY_LIMIT = 30;

/** Copy for non-technical users: every area is named, nothing is a "zone". */
export const AREA_NAMES = {
  header: 'Top brand area',
  content: 'Text area',
  image: 'Photo area',
  footer: 'Bottom brand area',
};

export const AREA_HINTS = {
  header: 'Filled by your brand kit. It always stays at the top and cannot move.',
  content: 'Where the headline, the words and the date and place information sit.',
  image: 'Where the photo goes. A layout can have one of these, or none.',
  footer: 'Filled by your brand kit. It always stays at the bottom and cannot move.',
};

/** Only these two areas may be moved or resized. */
export const EDITABLE_TYPES = ['content', 'image'];

export const LAYOUT_LABELS = {
  alignment: {
    label: 'Text position',
    values: { left: 'Words on the left', center: 'Words in the middle' },
  },
  spacing: {
    label: 'Gaps',
    values: { compact: 'Tight', normal: 'As they come', relaxed: 'Generous' },
  },
  imagePlacement: {
    label: 'Photo position',
    values: { top: 'At the top', middle: 'In the middle', bottom: 'At the bottom', none: 'No photo area' },
  },
  infoStyle: {
    label: 'Date and place',
    values: { card: 'In a box', stacked: 'In a list', inline: 'On one line' },
  },
  decoration: {
    label: 'Extra shape',
    values: { none: 'None', band: 'Soft band behind', circle: 'Soft circle behind' },
  },
};

const OPTION_KEYS = {
  alignment: ['left', 'center'],
  spacing: ['compact', 'normal', 'relaxed'],
  imagePlacement: ['top', 'middle', 'bottom', 'none'],
  infoStyle: ['card', 'inline', 'stacked'],
  decoration: ['none', 'band', 'circle'],
};

export function areaName(type) {
  return AREA_NAMES[type] || 'Area';
}

export function isEditableType(type) {
  return EDITABLE_TYPES.includes(type);
}

function toInt(value, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function snap(value, step = GRID_STEP) {
  return Math.round(Number(value) / step) * step;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function areaOf(zones, type) {
  return (zones || []).find((zone) => zone?.type === type) || null;
}

/** The clear strip between the two brand areas; nothing editable may enter a brand area. */
export function brandEdges(zones, size) {
  const header = areaOf(zones, 'header');
  const footer = areaOf(zones, 'footer');
  const top = header ? toInt(toInt(header.y, 0) + toInt(header.h, 0), 0) : 0;
  const bottom = footer ? toInt(footer.y, size.height) : size.height;
  return {
    top: clamp(top, 0, size.height),
    bottom: clamp(Math.max(bottom, top + MIN_AREA_SIZE.height), 0, size.height),
  };
}

/**
 * Snaps an area to the grid and pulls it back so it stays inside the poster, keeps
 * its minimum size and never covers a brand area. `grid: 1` keeps a typed value exact.
 */
export function constrainArea(rect, { size, zones, grid = GRID_STEP }) {
  const w = clamp(snap(rect.w, grid), MIN_AREA_SIZE.width, size.width);
  const h = clamp(snap(rect.h, grid), MIN_AREA_SIZE.height, size.height);
  const edges = brandEdges(zones, size);
  const minY = Math.min(edges.top, Math.max(0, edges.bottom - h));
  const maxY = Math.max(minY, edges.bottom - h);
  return {
    x: clamp(snap(rect.x, grid), 0, Math.max(0, size.width - w)),
    y: clamp(snap(rect.y, grid), minY, maxY),
    w,
    h,
  };
}

/** Same checks the server runs, as sentences an admin can act on. */
export function validateDraft(draft) {
  const problems = [];
  const name = String(draft?.name ?? '').trim();
  const size = { width: Number(draft?.size?.width), height: Number(draft?.size?.height) };
  const zones = Array.isArray(draft?.zones) ? draft.zones : [];

  if (name.length < 2) problems.push('Give the template a name of at least 2 characters.');
  if (name.length > NAME_LIMIT) problems.push(`The name must be ${NAME_LIMIT} characters or shorter.`);

  if (!Number.isFinite(size.width) || size.width < POSTER_LIMITS.minWidth || size.width > POSTER_LIMITS.maxWidth) {
    problems.push(
      `Poster width must be between ${POSTER_LIMITS.minWidth} and ${POSTER_LIMITS.maxWidth}.`
    );
  }
  if (
    !Number.isFinite(size.height) ||
    size.height < POSTER_LIMITS.minHeight ||
    size.height > POSTER_LIMITS.maxHeight
  ) {
    problems.push(
      `Poster height must be between ${POSTER_LIMITS.minHeight} and ${POSTER_LIMITS.maxHeight}.`
    );
  }

  for (const type of ['header', 'footer', 'content']) {
    const count = zones.filter((zone) => zone?.type === type).length;
    if (count !== 1) problems.push(`A template needs exactly one ${areaName(type)}.`);
  }
  if (zones.filter((zone) => zone?.type === 'image').length > 1) {
    problems.push(`A template can have only one ${areaName('image')}.`);
  }
  if (zones.length > MAX_AREAS) problems.push(`A template can have at most ${MAX_AREAS} areas.`);
  if (problems.length) return problems;

  const ids = new Set();
  for (const zone of zones) {
    if (ids.has(zone.id)) problems.push(`Two areas share the same name. Give each area its own name.`);
    ids.add(zone.id);
  }

  for (const zone of zones) {
    const label = areaName(zone.type);
    if (zone.w < MIN_AREA_SIZE.width || zone.h < MIN_AREA_SIZE.height) {
      problems.push(
        `The ${label} is too small. It must be at least ${MIN_AREA_SIZE.width} × ${MIN_AREA_SIZE.height}.`
      );
    }
    if (zone.x < 0 || zone.y < 0 || zone.x + zone.w > size.width || zone.y + zone.h > size.height) {
      problems.push(`The ${label} must sit fully inside the poster.`);
    }
    const minFont = Number(zone.minFont);
    const maxFont = Number(zone.maxFont);
    if (!(minFont >= TEXT_SIZE_RANGE.min && minFont <= TEXT_SIZE_RANGE.max)) {
      problems.push(`The ${label} smallest text size must be between ${TEXT_SIZE_RANGE.min} and ${TEXT_SIZE_RANGE.max}.`);
    }
    if (!(maxFont >= TEXT_SIZE_RANGE.min && maxFont <= TEXT_SIZE_RANGE.max)) {
      problems.push(`The ${label} largest text size must be between ${TEXT_SIZE_RANGE.min} and ${TEXT_SIZE_RANGE.max}.`);
    }
    if (minFont > maxFont) {
      problems.push(`The ${label} smallest text size must not be larger than its largest text size.`);
    }
  }

  const content = areaOf(zones, 'content');
  const minHeight = Math.round(size.height * MIN_TEXT_COVERAGE);
  if (content.h < minHeight) {
    problems.push(`The ${areaName('content')} must be at least ${minHeight} tall so there is room for the words.`);
  }

  const edges = brandEdges(zones, size);
  const image = areaOf(zones, 'image');
  if (image && (image.y < edges.top || image.y + image.h > edges.bottom)) {
    problems.push(`The ${areaName('image')} must stay between the two brand areas.`);
  }

  const fixed = [areaOf(zones, 'header'), areaOf(zones, 'footer'), content];
  for (let i = 0; i < fixed.length; i += 1) {
    for (let j = i + 1; j < fixed.length; j += 1) {
      if (overlaps(fixed[i], fixed[j])) {
        problems.push(`The ${areaName(fixed[i].type)} and the ${areaName(fixed[j].type)} cannot overlap.`);
      }
    }
  }

  const layout = draft?.layout || {};
  for (const [key, allowed] of Object.entries(OPTION_KEYS)) {
    if (!allowed.includes(layout[key])) problems.push(`Choose one of the listed options for "${LAYOUT_LABELS[key].label}".`);
  }

  return [...new Set(problems)];
}

/** First problem is usually enough for a banner; the list is for the details box. */
export function firstProblem(problems) {
  return problems.length > 0 ? problems[0] : '';
}

const toIntOr = (value, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * A saved template (or one version of it) as the editor's working copy: every number
 * whole, every area named, the brand areas present and the layout choices filled in.
 */
export function draftOfTemplate(template) {
  const size = resolveTemplateSize(template);
  const raw = Array.isArray(template?.zones) ? template.zones : [];
  const zones = raw.map((zone, index) => {
    const type = ['header', 'footer', 'content', 'image'].includes(zone?.type) ? zone.type : 'content';
    return {
      id: String(zone?.id ?? `area-${index}`),
      type,
      x: toIntOr(zone?.x, 0),
      y: toIntOr(zone?.y, 0),
      w: Math.max(1, toIntOr(zone?.w, size.width)),
      h: Math.max(1, toIntOr(zone?.h, size.height)),
      locked: type === 'header' || type === 'footer' ? true : Boolean(zone?.locked),
      minFont: toIntOr(zone?.minFont, FONT_DEFAULTS.minFont),
      maxFont: toIntOr(zone?.maxFont, FONT_DEFAULTS.maxFont),
    };
  });

  /* The server only ever stores a template with both brand areas and one text area, so
     a partial one comes from a seed or an old export; give it the standard bands. */
  if (!areaOf(zones, 'header')) {
    zones.unshift({ id: 'area-header', type: 'header', x: 0, y: 0, w: size.width, h: 140, locked: true, ...FONT_DEFAULTS });
  }
  if (!areaOf(zones, 'footer')) {
    zones.push({
      id: 'area-footer',
      type: 'footer',
      x: 0,
      y: Math.max(0, size.height - 130),
      w: size.width,
      h: 130,
      locked: true,
      ...FONT_DEFAULTS,
    });
  }
  if (!areaOf(zones, 'content')) {
    zones.splice(1, 0, {
      id: 'area-content',
      type: 'content',
      x: Math.round(size.width * 0.065),
      y: 170,
      w: Math.round(size.width * 0.87),
      h: Math.max(MIN_AREA_SIZE.height, Math.round(size.height * 0.66)),
      locked: false,
      ...FONT_DEFAULTS,
    });
  }

  const stored = template?.layout || {};
  const layout = { ...LAYOUT_BASE, imagePlacement: areaOf(zones, 'image') ? 'middle' : 'none' };
  for (const [key, allowed] of Object.entries(LAYOUT_OPTIONS)) {
    if (allowed.includes(stored[key])) layout[key] = stored[key];
  }

  return {
    name: String(template?.name ?? '').slice(0, NAME_LIMIT),
    category: TEMPLATE_CATEGORIES.includes(template?.category) ? template.category : 'Event',
    size,
    zones,
    layout,
  };
}

/** Two working copies are the same when their text matches, which is how "unsaved" is read. */
export function draftKey(draft) {
  return JSON.stringify(draft);
}
