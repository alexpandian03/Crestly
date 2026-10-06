/**
 * Template editor item rules shared by the API and the browser.
 *
 * Plain ESM on purpose: no imports, no Node-only or browser-only APIs, no environment
 * reads. Everything the checks need (cloud name, tenant id, brand kit, template) is
 * passed in, so the exact same numbers and sentences run on both sides.
 *
 * An "element" is one thing the editor places inside the content area of a poster:
 * a poster field (headline, date, photo...), a fixed piece of text, a photo or a shape.
 * The header and footer are painted by the brand kit and can never be elements.
 */

/** Bumped whenever the stored shape changes, so an old template can be recognised. */
export const EDITOR_VERSION = 2;
export const LEGACY_EDITOR_VERSION = 1;

export const ELEMENT_KINDS = ['field', 'text', 'image', 'shape'];

/** Poster words a field element can stand for. */
export const ELEMENT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details', 'photo'];
export const TEXT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details'];

export const TEXT_ALIGNS = ['left', 'center', 'right'];
export const IMAGE_FITS = ['cover', 'contain'];
export const SHAPE_TYPES = ['rect', 'circle', 'line'];

/** The only typefaces a template may ask for (the same list the brand kit offers). */
export const ELEMENT_FONTS = [
  'Outfit',
  'Inter',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Cinzel',
  'Roboto',
  'Open Sans',
  'Lato',
  'DM Sans',
  'Nunito',
];

export const ELEMENT_WEIGHTS = [400, 500, 600, 700, 800];

export const ELEMENT_LIMITS = {
  maxItems: 30,
  maxText: 10,
  maxImage: 6,
  maxShape: 10,
  /** A field or photo counts as one of these when it draws a picture. */
  minWidth: 40,
  minHeight: 24,
  textChars: 200,
  idChars: 40,
  fontSize: { min: 10, max: 200 },
  letterSpacing: { min: 0, max: 12 },
  lineHeight: { min: 0.9, max: 2 },
  opacity: { min: 0, max: 1 },
  radius: { min: 0, max: 64 },
  strokeWidth: { min: 0, max: 12 },
  z: { min: 0, max: 1000 },
};

/** A whole template document (items + history) must stay near this size. */
export const TEMPLATE_DOC_MAX_BYTES = 200 * 1024;

export const TEMPLATE_SIZE_FALLBACK = { width: 1080, height: 1350 };

/** Brand band heights, mirrored from the brand rules so this file needs no imports. */
export const BAND_HEIGHTS = {
  header: { min: 60, max: 200, default: 80 },
  footer: { min: 60, max: 260, default: 70 },
};

/** Keys an element may carry; anything else is dropped before it reaches the database. */
export const ELEMENT_KEYS = [
  'id',
  'kind',
  'field',
  'x',
  'y',
  'w',
  'h',
  'z',
  'locked',
  'style',
  'text',
  'imageUrl',
  'shape',
];

export const ELEMENT_STYLE_KEYS = [
  'fontFamily',
  'size',
  'minSize',
  'weight',
  'color',
  'align',
  'lineHeight',
  'letterSpacing',
  'uppercase',
  'italic',
  'opacity',
  'fit',
  'radius',
  'showIcon',
  'showLabel',
];

export const ELEMENT_SHAPE_KEYS = ['type', 'fill', 'stroke', 'strokeWidth'];

export const ELEMENT_STYLE_DEFAULTS = {
  fontFamily: 'Inter',
  size: 28,
  minSize: 12,
  weight: 500,
  color: '#0f172a',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
  uppercase: false,
  italic: false,
  opacity: 1,
  fit: 'cover',
  radius: 0,
  showIcon: true,
  showLabel: true,
};

export const ELEMENT_SHAPE_DEFAULTS = {
  type: 'rect',
  fill: '#059669',
  stroke: '',
  strokeWidth: 0,
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Smallest strip an editor still has room to work in, whatever the brand bands ask for. */
const MIN_CONTENT_STRIP = 120;

function toNumber(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = 0) {
  return Math.round(toNumber(value, fallback));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isNumber(value) {
  return Number.isFinite(typeof value === 'number' ? value : Number.parseFloat(value));
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

export function isHexColor(value) {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}

export function normalizeHexColor(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!HEX_COLOR.test(text)) return fallback;
  if (text.length === 4) {
    const [, r, g, b] = text;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return text.toLowerCase();
}

/** Plain words only: tags and control characters are removed, never stored. */
export function plainText(value, max = ELEMENT_LIMITS.textChars) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toPlain(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value.toObject === 'function') return value.toObject();
  if (isPlainObject(value)) return value;
  return value;
}

export function templateSizeOf(template) {
  const size = toPlain(template?.size);
  return {
    width: clamp(toInt(size?.width, TEMPLATE_SIZE_FALLBACK.width), 1, 4000),
    height: clamp(toInt(size?.height, TEMPLATE_SIZE_FALLBACK.height), 1, 6000),
  };
}

function bandHeight(value, range) {
  const n = toInt(value, range.default);
  return clamp(n, 0, range.max);
}

/**
 * The rectangle items are allowed to live in: the poster minus the brand header band at
 * the top and the brand footer band at the bottom. Both bands shrink proportionally when
 * together they would leave no room to design in.
 */
export function contentArea(brandKit, template) {
  const kit = toPlain(brandKit) || {};
  const size = templateSizeOf(template);
  let header = bandHeight(kit?.header?.height, BAND_HEIGHTS.header);
  let footer = bandHeight(kit?.footer?.height, BAND_HEIGHTS.footer);

  const room = Math.max(MIN_CONTENT_STRIP, size.height - MIN_CONTENT_STRIP);
  if (header + footer > room) {
    const scale = header + footer > 0 ? room / (header + footer) : 0;
    header = Math.floor(header * scale);
    footer = Math.floor(footer * scale);
  }
  header = Math.min(header, size.height);
  footer = Math.min(footer, size.height - header);

  return {
    x: 0,
    y: header,
    w: size.width,
    h: Math.max(0, size.height - header - footer),
  };
}

export function isInsideArea(rect, area) {
  return (
    rect.x >= area.x &&
    rect.y >= area.y &&
    rect.x + rect.w <= area.x + area.w &&
    rect.y + rect.h <= area.y + area.h
  );
}

/** Pulls a rectangle fully inside an area, keeping its size when it fits. */
export function clampRectToArea(rect, area) {
  const w = Math.min(rect.w, area.w);
  const h = Math.min(rect.h, area.h);
  return {
    x: clamp(rect.x, area.x, area.x + area.w - w),
    y: clamp(rect.y, area.y, area.y + area.h - h),
    w,
    h,
  };
}

export function intersectRect(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

function normalizeStyle(style) {
  const filled = { ...ELEMENT_STYLE_DEFAULTS, ...(isPlainObject(toPlain(style)) ? toPlain(style) : {}) };
  const size = clamp(toInt(filled.size, ELEMENT_STYLE_DEFAULTS.size), ELEMENT_LIMITS.fontSize.min, ELEMENT_LIMITS.fontSize.max);
  const minSize = clamp(
    toInt(filled.minSize, ELEMENT_STYLE_DEFAULTS.minSize),
    ELEMENT_LIMITS.fontSize.min,
    size
  );
  const weight = ELEMENT_WEIGHTS.includes(toInt(filled.weight, 500)) ? toInt(filled.weight, 500) : 500;
  return {
    fontFamily: ELEMENT_FONTS.includes(filled.fontFamily) ? filled.fontFamily : ELEMENT_STYLE_DEFAULTS.fontFamily,
    size,
    minSize,
    weight,
    color: normalizeHexColor(filled.color, ELEMENT_STYLE_DEFAULTS.color),
    align: TEXT_ALIGNS.includes(filled.align) ? filled.align : ELEMENT_STYLE_DEFAULTS.align,
    lineHeight: clamp(toNumber(filled.lineHeight, 1.2), ELEMENT_LIMITS.lineHeight.min, ELEMENT_LIMITS.lineHeight.max),
    letterSpacing: clamp(toInt(filled.letterSpacing, 0), ELEMENT_LIMITS.letterSpacing.min, ELEMENT_LIMITS.letterSpacing.max),
    uppercase: Boolean(filled.uppercase),
    italic: Boolean(filled.italic),
    opacity: clamp(toNumber(filled.opacity, 1), ELEMENT_LIMITS.opacity.min, ELEMENT_LIMITS.opacity.max),
    fit: IMAGE_FITS.includes(filled.fit) ? filled.fit : ELEMENT_STYLE_DEFAULTS.fit,
    radius: clamp(toInt(filled.radius, 0), ELEMENT_LIMITS.radius.min, ELEMENT_LIMITS.radius.max),
    showIcon: filled.showIcon !== false,
    showLabel: filled.showLabel !== false,
  };
}

function normalizeShape(shape) {
  const filled = { ...ELEMENT_SHAPE_DEFAULTS, ...(toPlain(shape) || {}) };
  return {
    type: SHAPE_TYPES.includes(filled.type) ? filled.type : ELEMENT_SHAPE_DEFAULTS.type,
    fill: normalizeHexColor(filled.fill, ''),
    stroke: normalizeHexColor(filled.stroke, ''),
    strokeWidth: clamp(toInt(filled.strokeWidth, 0), ELEMENT_LIMITS.strokeWidth.min, ELEMENT_LIMITS.strokeWidth.max),
  };
}

/** Fills in everything an element may be missing and drops keys it should not carry. */
export function normalizeElement(element, index = 0) {
  const raw = toPlain(element) || {};
  const kind = ELEMENT_KINDS.includes(raw.kind) ? raw.kind : 'text';
  const field = kind === 'field' && ELEMENT_FIELDS.includes(raw.field) ? raw.field : null;
  const out = {
    id: plainText(raw.id, ELEMENT_LIMITS.idChars) || `item-${index + 1}`,
    kind,
    x: toInt(raw.x, 0),
    y: toInt(raw.y, 0),
    w: toInt(raw.w, ELEMENT_LIMITS.minWidth),
    h: toInt(raw.h, ELEMENT_LIMITS.minHeight),
    z: clamp(toInt(raw.z, index), ELEMENT_LIMITS.z.min, ELEMENT_LIMITS.z.max),
    locked: Boolean(raw.locked),
    style: normalizeStyle(raw.style),
  };
  if (out.kind === 'field') out.field = field || 'headline';
  if (out.kind === 'text' || out.kind === 'field') out.text = plainText(raw.text);
  if (out.kind === 'image' || out.field === 'photo') {
    const url = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim().slice(0, 600) : '';
    out.imageUrl = /^https:\/\//i.test(url) ? url : '';
  }
  if (out.kind === 'shape') out.shape = normalizeShape(raw.shape);
  return out;
}

export function normalizeElements(elements) {
  const list = Array.isArray(elements) ? elements : [];
  return list.slice(0, ELEMENT_LIMITS.maxItems).map((element, index) => normalizeElement(element, index));
}

/**
 * Turns a zones-only template into editor items without touching the database, so an old
 * template opens in the new editor exactly where its areas used to be.
 */
export function legacyToElements(template, brandKit) {
  const source = toPlain(template) || {};
  const zones = (Array.isArray(source.zones) ? source.zones : []).map(toPlain);
  const area = contentArea(brandKit, source);
  const contentZone = zones.find((zone) => zone?.type === 'content');
  const imageZone = zones.find((zone) => zone?.type === 'image');
  const offsets = toPlain(toPlain(source.layout)?.itemOffsets) || {};

  const rect = contentZone
    ? {
        x: toInt(contentZone.x, area.x),
        y: toInt(contentZone.y, area.y),
        w: toInt(contentZone.w, area.w),
        h: toInt(contentZone.h, area.h),
      }
    : { ...area };

  // An old content area drawn before the brand bands existed can stick into a band; the
  // overlap is the part the new editor may use.
  const overlap = intersectRect(rect, area);
  const box =
    overlap.w >= ELEMENT_LIMITS.minWidth && overlap.h >= ELEMENT_LIMITS.minHeight
      ? overlap
      : { ...area };

  const headingFont = ELEMENT_FONTS.includes(toPlain(brandKit)?.content?.headingFont)
    ? toPlain(brandKit).content.headingFont
    : 'Outfit';
  const bodyFont = ELEMENT_FONTS.includes(toPlain(brandKit)?.content?.bodyFont)
    ? toPlain(brandKit).content.bodyFont
    : 'Inter';
  const headingColor = normalizeHexColor(toPlain(brandKit)?.content?.headingColor, '#0f172a');
  const bodyColor = normalizeHexColor(toPlain(brandKit)?.content?.bodyColor, '#334155');

  const minFont = clamp(toInt(contentZone?.minFont, 12), ELEMENT_LIMITS.fontSize.min, ELEMENT_LIMITS.fontSize.max);
  const maxFont = clamp(toInt(contentZone?.maxFont, 48), minFont, ELEMENT_LIMITS.fontSize.max);
  const align = toPlain(source.layout)?.alignment === 'center' ? 'center' : 'left';

  /** Reading order, with how much of the old text area each group used to take. */
  const rows = [
    { field: 'headline', weight: 3, size: maxFont, font: headingFont, color: headingColor, weight500: 700 },
    { field: 'tagline', weight: 2, size: clamp(roundTo(maxFont * 0.55, 1), minFont, maxFont), font: headingFont, color: headingColor, weight500: 500 },
    { field: 'date', weight: 1.5, size: clamp(roundTo(minFont * 1.4, 1), minFont, maxFont), font: bodyFont, color: bodyColor, weight500: 600 },
    { field: 'time', weight: 1.5, size: clamp(roundTo(minFont * 1.4, 1), minFont, maxFont), font: bodyFont, color: bodyColor, weight500: 600 },
    { field: 'venue', weight: 2, size: clamp(roundTo(minFont * 1.4, 1), minFont, maxFont), font: bodyFont, color: bodyColor, weight500: 600 },
    { field: 'details', weight: 3, size: minFont, font: bodyFont, color: bodyColor, weight500: 400 },
  ];

  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  let heights = rows.map((row) =>
    Math.max(ELEMENT_LIMITS.minHeight, Math.floor((box.h * row.weight) / totalWeight))
  );
  let used = heights.reduce((sum, value) => sum + value, 0);
  while (used > box.h) {
    const tallest = heights.indexOf(Math.max(...heights));
    if (heights[tallest] <= ELEMENT_LIMITS.minHeight) break;
    heights[tallest] -= 1;
    used -= 1;
  }

  const elements = [];
  let cursor = box.y;
  rows.forEach((row, index) => {
    const nudge = toPlain(offsets[row.field]) || {};
    const h = heights[index];
    const placed = clampRectToArea(
      {
        x: box.x + toInt(nudge.dx, 0),
        y: cursor + toInt(nudge.dy, 0),
        w: box.w,
        h,
      },
      area
    );
    cursor += h;
    elements.push({
      id: `field-${row.field}`,
      kind: 'field',
      field: row.field,
      ...placed,
      z: index,
      locked: false,
      style: {
        fontFamily: row.font,
        size: row.size,
        minSize: minFont,
        weight: row.weight500,
        color: row.color,
        align,
      },
      text: '',
    });
  });

  if (imageZone) {
    const nudge = toPlain(offsets.photo) || {};
    const placed = clampRectToArea(
      {
        x: toInt(imageZone.x, box.x) + toInt(nudge.dx, 0),
        y: toInt(imageZone.y, box.y) + toInt(nudge.dy, 0),
        w: toInt(imageZone.w, box.w),
        h: toInt(imageZone.h, Math.max(ELEMENT_LIMITS.minHeight, Math.floor(box.h * 0.3))),
      },
      area
    );
    elements.push({
      id: 'field-photo',
      kind: 'field',
      field: 'photo',
      ...placed,
      z: elements.length,
      locked: false,
      style: { fit: 'cover', radius: 0 },
      imageUrl: '',
    });
  }

  return elements.map((element, index) => normalizeElement(element, index));
}

/** The Cloudinary prefix a tenant's own pictures must start with. */
export function tenantImagePrefix(cloudName) {
  const cloud = typeof cloudName === 'string' && cloudName.trim() && cloudName.trim() !== 'your_cloud_name'
    ? cloudName.trim()
    : '';
  return cloud ? `https://res.cloudinary.com/${cloud}/` : 'https://res.cloudinary.com/';
}

export function checkElementImageUrl(url, { cloudName, clientId } = {}) {
  const value = typeof url === 'string' ? url.trim() : '';
  if (!value) return { ok: true };
  if (!value.startsWith(tenantImagePrefix(cloudName))) {
    return { ok: false, reason: 'Photos must come from your own image library.' };
  }
  if (clientId && !value.includes(`/brand/${clientId}/`)) {
    return { ok: false, reason: 'That photo belongs to another organization or another folder.' };
  }
  return { ok: true };
}

function labelFor(element) {
  if (element.kind === 'field') {
    const names = {
      headline: 'headline',
      tagline: 'line under the headline',
      date: 'date',
      time: 'time',
      venue: 'place',
      details: 'extra lines',
      photo: 'photo',
    };
    return names[element.field] || element.field;
  }
  if (element.kind === 'text') return 'text box';
  if (element.kind === 'image') return 'photo';
  return 'shape';
}

/**
 * Friendly problems with a set of elements: an empty list means it may be saved.
 * Overlapping items are allowed - posters often put words over a shape or a photo.
 */
export function validateElements(elements, context = {}) {
  if (!Array.isArray(elements)) return ['The items on this template are not a list.'];

  const problems = [];
  /* Bounds need the brand bands and the poster size; a caller that does not know them yet
     checks everything else and leaves the "inside the poster" rule to the caller that does. */
  const knowsBounds = Boolean(context.area || context.brandKit || context.template);
  const area = context.area || contentArea(context.brandKit, context.template);
  const counts = { text: 0, image: 0, shape: 0 };
  const fieldCounts = {};
  const ids = new Set();

  if (elements.length > ELEMENT_LIMITS.maxItems) {
    problems.push(`A template can hold at most ${ELEMENT_LIMITS.maxItems} items.`);
  }

  for (let index = 0; index < elements.length; index += 1) {
    const sent = toPlain(elements[index]);
    if (!isPlainObject(sent)) {
      problems.push('Every item needs its own settings.');
      continue;
    }

    const element = normalizeElement(sent, index);
    const label = labelFor(element);

    if (!ELEMENT_KINDS.includes(sent.kind)) {
      problems.push(`"${sent.kind}" is not a kind of item this editor can place.`);
      continue;
    }
    if (element.kind === 'field' && !ELEMENT_FIELDS.includes(sent.field)) {
      problems.push(`"${sent.field}" is not a part of the poster this editor can place.`);
      continue;
    }

    if (ids.has(element.id)) {
      problems.push(`Two items use the same name "${element.id}". Give each item its own name.`);
    }
    ids.add(element.id);

    if (element.kind === 'field') {
      fieldCounts[element.field] = (fieldCounts[element.field] || 0) + 1;
    } else {
      counts[element.kind] = (counts[element.kind] || 0) + 1;
    }

    if (element.imageUrl) {
      const check = checkElementImageUrl(element.imageUrl, context);
      if (!check.ok) problems.push(`The ${label}: ${check.reason}`);
    }

    const rawStyle = isPlainObject(toPlain(sent.style)) ? toPlain(sent.style) : null;
    if (sent.style !== undefined && !rawStyle) {
      problems.push(`The ${label} has look settings that are not a set of choices.`);
    }
    const colours = [
      ['colour', rawStyle?.color],
      ['shape colour', toPlain(sent.shape)?.fill],
      ['outline colour', toPlain(sent.shape)?.stroke],
    ];
    for (const [name, value] of colours) {
      if (value !== undefined && value !== null && value !== '' && !isHexColor(value)) {
        problems.push(`The ${label} has a ${name} that is not a hex value such as #1a2b3c.`);
      }
    }
    if (rawStyle?.fontFamily !== undefined && !ELEMENT_FONTS.includes(rawStyle.fontFamily)) {
      problems.push(`"${rawStyle.fontFamily}" is not one of the fonts this app offers.`);
    }
    const size = rawStyle?.size;
    const minSize = rawStyle?.minSize;
    if (isNumber(size)) {
      const value = toInt(size);
      if (value < ELEMENT_LIMITS.fontSize.min || value > ELEMENT_LIMITS.fontSize.max) {
        problems.push(
          `The ${label} has a text size outside ${ELEMENT_LIMITS.fontSize.min}-${ELEMENT_LIMITS.fontSize.max}.`
        );
      }
      if (isNumber(minSize) && toInt(minSize) > value) {
        problems.push(`The ${label} cannot shrink to a text size larger than its normal size.`);
      }
    }

    const rect = { x: element.x, y: element.y, w: element.w, h: element.h };
    if (rect.w < ELEMENT_LIMITS.minWidth || rect.h < ELEMENT_LIMITS.minHeight) {
      problems.push(
        `The ${label} is too small. It must be at least ${ELEMENT_LIMITS.minWidth} × ${ELEMENT_LIMITS.minHeight}.`
      );
    }
    if (knowsBounds && !isInsideArea(rect, area)) {
      problems.push(`The ${label} must sit fully inside the poster, clear of the header and footer.`);
    }
  }

  const headlineCount = fieldCounts.headline || 0;
  if (headlineCount !== 1) {
    problems.push(headlineCount === 0 ? 'A template needs a headline.' : 'A template can have only one headline.');
  }
  for (const field of ELEMENT_FIELDS) {
    if (field === 'headline') continue;
    if ((fieldCounts[field] || 0) > 1) {
      problems.push(`A template can show the ${labelFor({ kind: 'field', field })} only once.`);
    }
  }
  if (counts.text > ELEMENT_LIMITS.maxText) {
    problems.push(`A template can hold at most ${ELEMENT_LIMITS.maxText} text boxes.`);
  }
  if (counts.image > ELEMENT_LIMITS.maxImage) {
    problems.push(`A template can hold at most ${ELEMENT_LIMITS.maxImage} photos.`);
  }
  if (counts.shape > ELEMENT_LIMITS.maxShape) {
    problems.push(`A template can hold at most ${ELEMENT_LIMITS.maxShape} shapes.`);
  }

  return [...new Set(problems)];
}

export function firstElementProblem(elements, context = {}) {
  const problems = validateElements(elements, context);
  return problems.length > 0 ? problems[0] : '';
}

/** How big a value is once stored as JSON, used to keep a template document small. */
export function jsonBytes(value) {
  const text = JSON.stringify(value ?? {});
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length;
}
