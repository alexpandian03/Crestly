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

export const ELEMENT_KINDS = ['field', 'text', 'image', 'shape', 'icon'];

/** Poster words a field element can stand for. */
export const ELEMENT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details', 'photo'];
export const TEXT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details'];

export const TEXT_ALIGNS = ['left', 'center', 'right'];
export const IMAGE_FITS = ['cover', 'contain'];
export const SHAPE_TYPES = ['rect', 'circle', 'line'];

/**
 * The only pictures an icon item may ask for.
 *
 * Grouped by the kind of event they suit so a design can pick one by itself, and named after
 * the icon set this app already draws. A name outside this list is refused, so a template can
 * never ask for a picture that does not exist.
 */
export const ICON_GROUPS = {
  health: ['droplet', 'heart', 'heart-pulse', 'activity', 'leaf', 'shield'],
  festival: ['sparkles', 'flame', 'gift', 'music', 'mic', 'sun'],
  sports: ['trophy', 'medal', 'award', 'flag', 'rocket'],
  education: ['graduation-cap', 'book-open', 'lightbulb', 'brain'],
  corporate: ['briefcase', 'globe', 'mail', 'phone'],
  awareness: ['megaphone', 'bell'],
  meeting: ['users', 'calendar', 'clock'],
  notice: ['map-pin', 'star', 'moon'],
  celebration: ['gift', 'sparkles', 'music', 'flag'],
  general: ['star', 'sparkles', 'heart', 'flag'],
};

export const ICON_NAMES = [...new Set(Object.values(ICON_GROUPS).flat())];

/** Used when nothing suitable was chosen: a plain mark that fits any poster. */
export const ICON_FALLBACK = 'star';

/** How thick an icon's lines are drawn by default. */
export const ICON_STROKE_DEFAULT = 2;

/** The picture to draw when a design asks for one that is not known. */
export function iconForCategory(category) {
  const group = ICON_GROUPS[typeof category === 'string' ? category.trim().toLowerCase() : ''];
  return group && group.length > 0 ? group[0] : ICON_FALLBACK;
}

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

/**
 * Fill-in slots.
 *
 * An item the admin adds can be marked "variable", which turns it from a fixed piece of
 * the design into a slot somebody else fills in later:
 *  - a variable TEXT is written by the assistant from the words of the event and can then
 *    be edited by the person making the poster;
 *  - a variable IMAGE is never generated - the person replaces the placeholder picture.
 * Every slot is named by a `key`, which is how the filled-in value finds its box again.
 */
export const VARIABLE_LIMITS = {
  maxText: 10,
  maxImage: 4,
  key: { min: 2, max: 24 },
  labelChars: 30,
  hintChars: 80,
  /** How long one filled-in line of words may be. */
  maxLength: { min: 10, max: 200, default: 80 },
  /** Everything a poster fills in, kept small enough to store and print. */
  valuesTotalBytes: 4096,
};

export const VARIABLE_KEY_PATTERN = /^[a-z0-9_]{2,24}$/;

/** Hosts a poster picture may come from: this app's own storage, or the image library. */
export const POSTER_IMAGE_HOSTS = ['res.cloudinary.com', 'images.pexels.com'];

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
  /** An icon's line weight is its own, thinner range. */
  iconStrokeWidth: { min: 1, max: 4 },
  nameChars: 40,
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
  'name',
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
  'variable',
  'key',
  'label',
  'hint',
  'maxLength',
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
  'strokeWidth',
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

/** A slot name is lower-case with underscores so a poster can carry it in a web address. */
function normalizeVariableKey(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VARIABLE_KEY_PATTERN.test(text) ? text : '';
}

/** An icon is named, never drawn from a free address: only the pictures this app has. */
export function normalizeIconName(value) {
  const name = typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '-') : '';
  return ICON_NAMES.includes(name) ? name : '';
}

function derivedKey(kind, index) {
  return `${kind === 'image' ? 'photo' : 'words'}-slot-${index + 1}`.slice(0, VARIABLE_LIMITS.key.max);
}

/**
 * The fill-in settings of one item, or null when the item is fixed. Only a text box or a
 * picture can become a slot - the poster's own headline, date and photo are filled by the
 * rules that already exist for them.
 */
function normalizeVariable(raw, index) {
  if (!raw.variable) return null;
  const key = normalizeVariableKey(raw.key) || derivedKey(raw.kind, index);
  const slot = {
    variable: true,
    key,
    label: plainText(raw.label, VARIABLE_LIMITS.labelChars),
    hint: plainText(raw.hint, VARIABLE_LIMITS.hintChars),
  };
  if (raw.kind === 'text') {
    slot.maxLength = clamp(
      toInt(raw.maxLength, VARIABLE_LIMITS.maxLength.default),
      VARIABLE_LIMITS.maxLength.min,
      VARIABLE_LIMITS.maxLength.max
    );
  }
  return slot;
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
  if (out.kind === 'icon') {
    out.name = normalizeIconName(raw.name);
    out.style = {
      ...out.style,
      strokeWidth: clamp(
        toInt(raw?.style?.strokeWidth, ICON_STROKE_DEFAULT),
        ELEMENT_LIMITS.iconStrokeWidth.min,
        ELEMENT_LIMITS.iconStrokeWidth.max
      ),
    };
  }
  if (out.kind === 'image' || out.field === 'photo') {
    const url = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim().slice(0, 600) : '';
    out.imageUrl = /^https:\/\//i.test(url) ? url : '';
  }
  if (out.kind === 'shape') out.shape = normalizeShape(raw.shape);
  const variable = normalizeVariable({ ...raw, kind: out.kind }, index);
  if (variable && (out.kind === 'text' || out.kind === 'image')) Object.assign(out, variable);
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
  if (element.variable && element.label) return `“${element.label}”`;
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
  if (element.kind === 'icon') return `icon (${element.name || 'not chosen'})`;
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
  const slotKeys = new Set();
  let variableTexts = 0;
  let variableImages = 0;

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
    if (element.kind === 'icon') {
      const name = typeof sent.name === 'string' ? sent.name.trim() : '';
      if (!name) {
        problems.push('An icon needs a picture chosen from the ones this app draws.');
      } else if (!normalizeIconName(name)) {
        problems.push(`"${name}" is not a picture this app can draw.`);
      }
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

    if (sent.variable) {
      if (element.kind !== 'text' && element.kind !== 'image') {
        problems.push('Only a text box or a picture of its own can be filled in later.');
      } else if (element.kind === 'text') {
        variableTexts += 1;
      } else {
        variableImages += 1;
      }

      const key = typeof sent.key === 'string' ? sent.key.trim() : '';
      if (!key) {
        problems.push(`The ${label} needs a name to be filled in under.`);
      } else if (!VARIABLE_KEY_PATTERN.test(key)) {
        problems.push(
          `"${key}" is not a name a fill-in can use. Use 2-${VARIABLE_LIMITS.key.max} lower-case letters, numbers or underscores.`
        );
      } else if (slotKeys.has(key)) {
        problems.push(`Two fill-ins share the name "${key}". Give each one its own name.`);
      } else {
        slotKeys.add(key);
      }

      for (const [name, value, max] of [
        ['name shown to the user', sent.label, VARIABLE_LIMITS.labelChars],
        ['hint', sent.hint, VARIABLE_LIMITS.hintChars],
      ]) {
        if (value !== undefined && typeof value !== 'string') {
          problems.push(`The ${label} has a ${name} that is not text.`);
        } else if (typeof value === 'string' && value.trim().length > max) {
          problems.push(`The ${label} has a ${name} longer than ${max} characters.`);
        }
      }

      if (element.kind === 'text' && sent.maxLength !== undefined) {
        const { min, max } = VARIABLE_LIMITS.maxLength;
        if (!isNumber(sent.maxLength) || !Number.isInteger(toNumber(sent.maxLength))) {
          problems.push(`The ${label} must be filled in with a whole number of characters.`);
        } else {
          const value = toInt(sent.maxLength);
          if (value < min || value > max) {
            problems.push(`The ${label} can hold between ${min} and ${max} characters.`);
          }
        }
      }
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

    if (element.kind === 'icon' && isNumber(rawStyle?.strokeWidth)) {
      const { min, max } = ELEMENT_LIMITS.iconStrokeWidth;
      const value = toNumber(rawStyle.strokeWidth);
      if (value < min || value > max) {
        problems.push(`The ${label} draws its lines between ${min} and ${max} pixels thick.`);
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
  if (variableTexts > VARIABLE_LIMITS.maxText) {
    problems.push(`A template can hold at most ${VARIABLE_LIMITS.maxText} texts to be filled in.`);
  }
  if (variableImages > VARIABLE_LIMITS.maxImage) {
    problems.push(`A template can hold at most ${VARIABLE_LIMITS.maxImage} photos to be replaced.`);
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

/* ------------------------------------------------------------------------- *
 * Fill-in slots on a poster
 * ------------------------------------------------------------------------- */

/** The items a poster design was made with, read out of its own stored snapshot. */
export function elementsOfDesign(design) {
  const template = toPlain(toPlain(design)?.template);
  const elements = toPlain(template?.elements);
  return Array.isArray(elements) ? elements : [];
}

/**
 * Which blanks a set of items offers: `texts` are written by the assistant and then
 * editable, `images` are replaced by the person making the poster.
 */
export function variableSlotsOf(elements) {
  const slots = { texts: [], images: [] };
  normalizeElements(elements).forEach((element) => {
    if (!element.variable) return;
    const slot = {
      id: element.id,
      key: element.key,
      label: element.label || element.key,
      hint: element.hint || '',
    };
    if (element.kind === 'text') slots.texts.push({ ...slot, maxLength: element.maxLength });
    else if (element.kind === 'image') slots.images.push(slot);
  });
  return slots;
}

/** Only what the assistant needs to know about each blank - kept short on purpose. */
export function aiSlotsOf(elements) {
  return variableSlotsOf(elements).texts.map(({ key, label, hint, maxLength }) => ({
    key,
    label,
    hint,
    maxLength,
  }));
}

/** A poster picture: this app's own storage for this organization, or the image library. */
export function checkContentImageUrl(url, { cloudName, clientId } = {}) {
  const value = typeof url === 'string' ? url.trim() : '';
  if (!value) return { ok: true };
  let parsed = null;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'That photo address is not a full web address.' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'A photo must come from a secure (https) web address.' };
  if (parsed.hostname === 'images.pexels.com') return { ok: true };
  if (parsed.hostname === 'res.cloudinary.com') return checkElementImageUrl(value, { cloudName, clientId });
  return { ok: false, reason: 'Photos must come from your own image library.' };
}

/**
 * The words and pictures a poster fills into its template's blanks, checked against the
 * blanks the design actually offers. Returns the values as they should be stored plus any
 * plain-word problems; nothing here writes to the database.
 */
export function resolveContentValues(content, { elements = [], cloudName = '', clientId = '' } = {}) {
  const slots = variableSlotsOf(elements);
  const texts = new Map(slots.texts.map((slot) => [slot.key, slot]));
  const pictures = new Map(slots.images.map((slot) => [slot.key, slot]));
  const problems = [];
  const extras = {};
  const images = {};

  const rawExtras = toPlain(content?.extras);
  if (rawExtras !== undefined && rawExtras !== null) {
    if (!isPlainObject(rawExtras)) {
      problems.push('Words filled into a template must be given as a set of labelled values.');
    } else {
      for (const [key, value] of Object.entries(rawExtras)) {
        const slot = texts.get(key);
        if (!slot) {
          problems.push(`"${key}" is not a blank this poster offers.`);
          continue;
        }
        if (typeof value !== 'string') {
          problems.push(`The ${slot.label} must be words.`);
          continue;
        }
        const words = plainText(value, VARIABLE_LIMITS.maxLength.max);
        if (words.length > slot.maxLength) {
          problems.push(`The ${slot.label} cannot be longer than ${slot.maxLength} characters.`);
          continue;
        }
        if (words) extras[key] = words;
      }
    }
  }

  const rawImages = toPlain(content?.images);
  if (rawImages !== undefined && rawImages !== null) {
    if (!isPlainObject(rawImages)) {
      problems.push('Photos filled into a template must be given as a set of labelled values.');
    } else {
      for (const [key, value] of Object.entries(rawImages)) {
        const slot = pictures.get(key);
        if (!slot) {
          problems.push(`"${key}" is not a photo this poster offers.`);
          continue;
        }
        if (typeof value !== 'string') {
          problems.push(`The photo "${slot.label}" must be a web address.`);
          continue;
        }
        const url = value.trim().slice(0, 600);
        const check = checkContentImageUrl(url, { cloudName, clientId });
        if (!check.ok) {
          problems.push(`The photo "${slot.label}": ${check.reason}`);
          continue;
        }
        if (url) images[key] = url;
      }
    }
  }

  if (!problems.length && jsonBytes({ extras, images }) > VARIABLE_LIMITS.valuesTotalBytes) {
    problems.push('There is too much to fill in on one poster. Please shorten the words.');
  }

  return {
    extras: Object.keys(extras).length ? extras : undefined,
    images: Object.keys(images).length ? images : undefined,
    problems,
  };
}
