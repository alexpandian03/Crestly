/**
 * Design recipes: how a poster's items are put together.
 *
 * Same rules as /shared/templateElements.js: plain ESM, no environment reads, no Node-only or
 * browser-only APIs, nothing that draws. A recipe only returns items in the format the template
 * editor already stores, so the server can save them, check them with the same function the
 * browser uses, and the browser can render them without knowing a recipe ever existed.
 *
 * Every colour comes out of the brand kit through tint()/shade(); a recipe never invents one.
 * The header and footer belong to the brand kit, so a recipe only ever works inside the
 * content area it is handed.
 */
import {
  ELEMENT_FONTS,
  ELEMENT_LIMITS,
  ICON_FALLBACK,
  ICON_STROKE_DEFAULT,
  VARIABLE_LIMITS,
  clampRectToArea,
  contentArea,
  iconForCategory,
  normalizeElements,
  normalizeHexColor,
  normalizeIconName,
  plainText,
} from './templateElements.js';

/** Bumped whenever a recipe's shape changes, so a poster can keep the look it was made with. */
export const RECIPE_VERSION = 1;

/** What a design can be for. A recipe lists the ones it suits. */
export const DESIGN_CATEGORIES = [
  'health',
  'festival',
  'sports',
  'education',
  'corporate',
  'awareness',
  'notice',
  'meeting',
  'celebration',
  'general',
];

/** Four arrangements per recipe; the numbers are the option value. */
export const RECIPE_VARIANTS = [0, 1, 2, 3];

export const RECIPE_PALETTES = ['brand', 'bright', 'deep', 'duo'];
export const RECIPE_TYPE_STYLES = ['bold', 'elegant', 'compact'];
export const RECIPE_DECORATIONS = ['none', 'ring', 'dots', 'corners'];
export const RECIPE_ARTWORKS = ['none', 'medallion', 'emblem', 'stacked'];

export const RECIPE_OPTIONS_DEFAULT = {
  variant: 0,
  palette: 'brand',
  typeStyle: 'bold',
  decoration: 'none',
  artwork: 'medallion',
};

/** Smallest text a recipe may set, whatever the poster size: still readable from a wall. */
export const MIN_RECIPE_FONT = 20;
/** Decorative shapes sit behind everything and stay barely visible. */
export const DECORATION_MAX_OPACITY = 0.08;

const MARGIN_RATIO = 0.062;
const ROW_GAP_RATIO = 0.022;
const COL_GAP_RATIO = 0.028;
const MIN_CELL_WIDTH = 150;

/** The brand kit's own shipped defaults, so a kit with missing colours still gets a real one. */
const BRAND_DEFAULTS = {
  primary: '#059669',
  secondary: '#0f172a',
  accent: '#10b981',
  text: '#ffffff',
  background: '#0b0f17',
  headingColor: '#0f172a',
  bodyColor: '#334155',
  cardBackground: '#f8fafc',
  cardBorder: '#e2e8f0',
  headingFont: 'Outfit',
  bodyFont: 'Inter',
};

/** The fill-in blanks a recipe may offer, in the words a person sees. */
export const DESIGN_BLANKS = {
  title_sub: { label: 'Line above the title', hint: 'A few short words that lead into the title', maxLength: 40 },
  slogan_1: { label: 'Slogan line one', hint: 'A short catchy line people remember', maxLength: 34 },
  slogan_2: { label: 'Slogan line two', hint: 'A second short line under the first', maxLength: 34 },
  cta_line: { label: 'Call to action', hint: 'What you want people to do next', maxLength: 48 },
  cta_button: { label: 'Button words', hint: 'Two or three words for the button', maxLength: 20 },
};

/* ------------------------------------------------------------------------- *
 * Colour: everything comes from the brand kit
 * ------------------------------------------------------------------------- */

function numberOr(value, fallback) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function colorOf(...values) {
  for (const value of values) {
    const hex = normalizeHexColor(value, '');
    if (hex) return hex;
  }
  return '';
}

function toRgb(color) {
  const hex = colorOf(color);
  if (!hex) return null;
  const body = hex.slice(1);
  const pairs =
    body.length === 3
      ? body.split('').map((part) => part + part)
      : [body.slice(0, 2), body.slice(2, 4), body.slice(4, 6)];
  return pairs.map((pair) => Number.parseInt(pair, 16));
}

function toHex(rgb) {
  return `#${rgb
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function blend(color, target, amount) {
  const from = toRgb(color);
  if (!from) return colorOf(color) || BRAND_DEFAULTS.primary;
  const ratio = clamp(numberOr(amount, 0.1), 0, 1);
  return toHex(from.map((value, index) => value + (target[index] - value) * ratio));
}

/** A brand colour lightened toward white. `amount` is 0..1. */
export function tint(color, amount = 0.1) {
  return blend(color, [255, 255, 255], amount);
}

/** A brand colour darkened toward black. `amount` is 0..1. */
export function shade(color, amount = 0.1) {
  return blend(color, [0, 0, 0], amount);
}

/** Rough perceptual brightness, used only to choose which brand colour reads on a surface. */
function isLight(color) {
  const rgb = toRgb(color);
  if (!rgb) return true;
  const [r, g, b] = rgb.map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

function fontOf(...values) {
  for (const value of values) {
    if (typeof value === 'string' && ELEMENT_FONTS.includes(value.trim())) return value.trim();
  }
  return '';
}

/**
 * The brand kit reduced to what a recipe needs: six colours and two fonts. Given a full kit, a
 * plain set of colours, or nothing at all - never an id, a URL or a secret.
 */
export function brandOf(brandKit) {
  const kit = brandKit && typeof brandKit === 'object' && !Array.isArray(brandKit) ? brandKit : {};
  const colors = kit.colors && typeof kit.colors === 'object' ? kit.colors : {};
  const content = kit.content && typeof kit.content === 'object' ? kit.content : {};
  const fonts = kit.fonts && typeof kit.fonts === 'object' ? kit.fonts : {};
  const card = content.infoCard && typeof content.infoCard === 'object' ? content.infoCard : {};

  const primary = colorOf(colors.primary, content.accentColor, BRAND_DEFAULTS.primary);
  const secondary = colorOf(colors.secondary, BRAND_DEFAULTS.secondary);
  const accent = colorOf(colors.accent, primary);
  const namedText = colorOf(colors.text, BRAND_DEFAULTS.text);
  const heading = colorOf(content.headingColor, secondary);

  return {
    primary,
    secondary,
    accent,
    dark: colorOf(colors.background, shade(primary, 0.6)),
    ink: heading,
    body: colorOf(content.bodyColor, heading),
    card: colorOf(card.background, tint(primary, 0.92)),
    line: colorOf(card.border, tint(primary, 0.8)),
    /* Words that sit on a dark surface: the brand's own light colour when it is light,
       otherwise a strong wash of the brand's main colour, so contrast never comes from us. */
    light: isLight(namedText) ? namedText : tint(primary, 0.96),
    headingFont: fontOf(fonts.heading, content.headingFont, BRAND_DEFAULTS.headingFont),
    bodyFont: fontOf(fonts.body, content.bodyFont, BRAND_DEFAULTS.bodyFont),
  };
}

/**
 * Which brand colour plays which role. Four palettes, all reading the same six brand colours in
 * a different order, so a design changes mood without ever leaving the brand.
 */
const PALETTES = {
  brand: (b) => ({
    background: tint(b.primary, 0.94),
    title: b.ink,
    accent: b.primary,
    band: tint(b.primary, 0.88),
  }),
  bright: (b) => ({
    background: tint(b.accent, 0.9),
    title: b.ink,
    accent: b.accent,
    band: tint(b.accent, 0.82),
  }),
  deep: (b) => ({
    background: tint(b.primary, 0.9),
    title: b.ink,
    accent: shade(b.primary, 0.15),
    band: shade(b.primary, 0.2),
  }),
  duo: (b) => ({
    background: tint(b.ink, 0.92),
    title: shade(b.primary, 0.1),
    accent: b.primary,
    band: b.secondary,
  }),
};

function paletteOf(brand, name) {
  const make = PALETTES[RECIPE_PALETTES.includes(name) ? name : RECIPE_OPTIONS_DEFAULT.palette];
  const roles = make(brand);
  return {
    ...roles,
    /* Words placed on the band or on the accent colour: whichever brand colour reads on it. */
    onBand: isLight(roles.band) ? brand.ink : brand.light,
    onAccent: isLight(roles.accent) ? brand.ink : brand.light,
    sub: brand.body,
    panel: brand.card,
    edge: brand.line,
    wash: roles.accent,
  };
}

/* ------------------------------------------------------------------------- *
 * Type, decoration, artwork
 * ------------------------------------------------------------------------- */

/** `ratio` is the headline against the line under it: how much louder the title is. */
const TYPE_STYLES = {
  bold: { scale: 1, ratio: 2.6, titleWeight: 800, subWeight: 600, letterSpacing: 2, uppercase: true },
  elegant: { scale: 0.92, ratio: 2.1, titleWeight: 600, subWeight: 500, letterSpacing: 1, uppercase: false },
  compact: { scale: 0.8, ratio: 1.7, titleWeight: 700, subWeight: 500, letterSpacing: 0, uppercase: false },
};

function typeOf(name) {
  return TYPE_STYLES[RECIPE_TYPE_STYLES.includes(name) ? name : RECIPE_OPTIONS_DEFAULT.typeStyle];
}

function sizesOf(type, width) {
  const title = Math.max(MIN_RECIPE_FONT, Math.round(width * 0.075 * type.scale));
  const sub = Math.max(MIN_RECIPE_FONT, Math.round(title / type.ratio));
  const body = Math.max(MIN_RECIPE_FONT, Math.round(sub * 0.85));
  return {
    title,
    sub,
    body,
    small: Math.max(MIN_RECIPE_FONT, Math.round(body * 0.92)),
    button: Math.max(MIN_RECIPE_FONT, Math.round(body * 1.05)),
  };
}

/* ------------------------------------------------------------------------- *
 * Geometry helpers
 * ------------------------------------------------------------------------- */

function boxOf(rect) {
  return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
}

/** The working box: the content area with a margin so nothing crowds the brand bands or an edge. */
function frameOf(area) {
  const margin = Math.round(clamp(area.w * MARGIN_RATIO, 20, 120));
  return boxOf({
    x: area.x + margin,
    y: area.y + margin,
    w: Math.max(ELEMENT_LIMITS.minWidth, area.w - margin * 2),
    h: Math.max(ELEMENT_LIMITS.minHeight, area.h - margin * 2),
  });
}

/** Splits a length into weighted parts, giving the leftover to the last one. */
function splitSizes(total, weights) {
  const sum = weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const sizes = weights.map((weight) => Math.max(1, Math.floor((total * weight) / sum)));
  const used = sizes.reduce((acc, size) => acc + size, 0);
  sizes[sizes.length - 1] += Math.max(0, total - used);
  return sizes;
}

/** Rows stacked inside a box, each at least one pixel apart. */
function rowsIn(box, weights, gap) {
  const room = Math.max(weights.length, box.h - gap * (weights.length - 1));
  const sizes = splitSizes(room, weights);
  let cursor = box.y;
  return sizes.map((size) => {
    const rect = { x: box.x, y: cursor, w: box.w, h: size };
    cursor += size + gap;
    return rect;
  });
}

function colsIn(box, weights, gap) {
  const room = Math.max(weights.length, box.w - gap * (weights.length - 1));
  const sizes = splitSizes(room, weights);
  let cursor = box.x;
  return sizes.map((size) => {
    const rect = { x: cursor, y: box.y, w: size, h: box.h };
    cursor += size + gap;
    return rect;
  });
}

function inset(rect, dx, dy = dx) {
  return boxOf({
    x: rect.x + dx,
    y: rect.y + dy,
    w: Math.max(1, rect.w - dx * 2),
    h: Math.max(1, rect.h - dy * 2),
  });
}

/** A square that fits inside a box, centred in it. */
function squareIn(rect) {
  const side = Math.max(ELEMENT_LIMITS.minWidth, Math.min(rect.w, rect.h));
  return boxOf({
    x: rect.x + (rect.w - side) / 2,
    y: rect.y + (rect.h - side) / 2,
    w: side,
    h: side,
  });
}

/* ------------------------------------------------------------------------- *
 * Item builders - the shared element format, nothing else
 * ------------------------------------------------------------------------- */

function minBox(rect, area) {
  const fixed = {
    x: rect.x,
    y: rect.y,
    w: Math.max(ELEMENT_LIMITS.minWidth, rect.w),
    h: Math.max(ELEMENT_LIMITS.minHeight, rect.h),
  };
  return clampRectToArea(fixed, area);
}

function textStyle(c, role, extra = {}) {
  const sizes = c.sizes;
  const size = sizes[role] || sizes.body;
  const isTitle = role === 'title';
  return {
    fontFamily: isTitle ? c.brand.headingFont : c.brand.bodyFont,
    size,
    minSize: Math.max(MIN_RECIPE_FONT, Math.round(size * 0.62)),
    weight: isTitle ? c.type.titleWeight : c.type.subWeight,
    color: extra.color || (isTitle ? c.palette.title : c.palette.sub),
    align: extra.align || c.align,
    lineHeight: extra.lineHeight || (isTitle ? 1.05 : role === 'body' ? 1.35 : 1.2),
    letterSpacing: isTitle ? c.type.letterSpacing : 0,
    uppercase: extra.uppercase === undefined ? (isTitle && c.type.uppercase) : extra.uppercase,
    italic: Boolean(extra.italic),
    opacity: 1,
  };
}

function makeItem(c, id, kind, rect, extra = {}) {
  return {
    id,
    kind,
    ...minBox(rect, c.area),
    z: extra.z === undefined ? 10 : extra.z,
    locked: Boolean(extra.locked),
    style: extra.style || {},
    ...(extra.rest || {}),
  };
}

/** One of the poster's own parts: the words come from the poster, not from the design. */
function fieldItem(c, id, field, rect, { style, z = 10, imageUrl = '' } = {}) {
  const item = makeItem(c, id, 'field', rect, { z, style: style || textStyle(c, field === 'headline' ? 'title' : 'body') });
  item.field = field;
  item.text = '';
  if (field === 'photo') item.imageUrl = imageUrl;
  return item;
}

/** A fill-in blank: the assistant writes it, then the person making the poster can change it. */
function blankItem(c, id, key, rect, { style, z = 10 } = {}) {
  const blank = DESIGN_BLANKS[key] || { label: key, hint: '', maxLength: VARIABLE_LIMITS.maxLength.default };
  const item = makeItem(c, id, 'text', rect, { z, style: style || textStyle(c, 'body') });
  item.text = '';
  item.variable = true;
  item.key = key;
  item.label = blank.label;
  item.hint = blank.hint;
  item.maxLength = blank.maxLength;
  return item;
}

function shapeItem(c, id, rect, { fill = '', stroke = '', strokeWidth = 0, radius = 0, opacity = 1, z = 2 } = {}) {
  /* A shape paints from its own fill and stroke; the style colour only carries the brand edge
     colour so the item never asks for a colour the brand kit does not have. */
  const style = { ...textStyle(c, 'body'), color: c.palette.edge, opacity, radius };
  const item = makeItem(c, id, 'shape', rect, { z, style });
  item.shape = { type: 'rect', fill, stroke, strokeWidth };
  return item;
}

function circleItem(c, id, rect, { fill = '', stroke = '', strokeWidth = 0, opacity = 1, z = 2 } = {}) {
  const item = shapeItem(c, id, rect, { fill, stroke, strokeWidth, opacity, z });
  item.shape.type = 'circle';
  return item;
}

function iconItem(c, id, rect, { name, color, strokeWidth = ICON_STROKE_DEFAULT, opacity = 1, z = 6 } = {}) {
  const style = { ...textStyle(c, 'body'), color: color || c.palette.accent, opacity, strokeWidth };
  const item = makeItem(c, id, 'icon', rect, { z, style });
  item.name = normalizeIconName(name) || ICON_FALLBACK;
  return item;
}

/** An artwork picture of its own, kept only when it comes from this app's image library. */
function libraryPhoto(url) {
  const value = typeof url === 'string' ? url.trim().slice(0, 600) : '';
  return /^https:\/\/res\.cloudinary\.com\//i.test(value) ? value : '';
}

function pictureItem(c, id, rect, url, { radius = 24, z = 4 } = {}) {
  const style = { ...textStyle(c, 'body'), radius, fit: 'cover' };
  const item = makeItem(c, id, 'image', rect, { z, style });
  item.imageUrl = url;
  return item;
}

/* ------------------------------------------------------------------------- *
 * Shared blocks
 * ------------------------------------------------------------------------- */

/**
 * Date, place and time. They must never sit on top of each other, so they are placed side by
 * side with small marks between them - and stacked one under the other when the space is too
 * narrow for three readable columns.
 */
function factCells(c, rect, keys, { marks = true, gapRatio = COL_GAP_RATIO } = {}) {
  const items = [];
  const widths = keys.map((key) => c.words[key].length);
  const sideBySide =
    marks &&
    keys.length > 1 &&
    Math.floor((rect.w - (keys.length - 1) * (ELEMENT_LIMITS.minWidth + rect.w * 0.034)) / keys.length) >= MIN_CELL_WIDTH;

  if (keys.length === 1) {
    items.push(fieldItem(c, `field-${keys[0]}`, keys[0], rect, { style: textStyle(c, 'body', { color: c.factColor }) }));
    return items;
  }

  if (!sideBySide) {
    const rows = rowsIn(rect, keys.map((key, index) => 1 + (widths[index] > 28 ? 0.4 : 0)), Math.round(rect.h * 0.06));
    keys.forEach((key, index) => {
      items.push(
        fieldItem(c, `field-${key}`, key, rows[index], {
          style: textStyle(c, 'small', { color: c.factColor, align: c.align }),
        })
      );
    });
    return items;
  }

  const gap = Math.max(4, Math.round(rect.w * gapRatio));
  const mark = ELEMENT_LIMITS.minWidth;
  const cell = Math.floor((rect.w - (keys.length - 1) * (gap * 2 + mark)) / keys.length);
  let cursor = rect.x;
  keys.forEach((key, index) => {
    items.push(
      fieldItem(c, `field-${key}`, key, { x: cursor, y: rect.y, w: cell, h: rect.h }, {
        style: textStyle(c, 'small', { color: c.factColor, align: index === 0 ? c.align : 'center' }),
      })
    );
    cursor += cell;
    if (index < keys.length - 1) {
      cursor += gap;
      const markRect = {
        x: cursor,
        y: rect.y + Math.round((rect.h - ELEMENT_LIMITS.minHeight) / 2),
        w: mark,
        h: ELEMENT_LIMITS.minHeight,
      };
      items.push(
        shapeItem(c, `mark-${key}`, markRect, {
          fill: tint(c.palette.accent, 0.35),
          radius: Math.round(ELEMENT_LIMITS.minHeight / 2),
          z: 3,
        })
      );
      cursor += mark + gap;
    }
  });
  return items;
}

/** The soft plate behind a row of facts, or a headline band: one rounded box, words on top. */
function plateItem(c, id, rect, { fill, radius, opacity = 1, z = 2 } = {}) {
  return shapeItem(c, id, rect, {
    fill: fill || c.palette.band,
    radius: radius === undefined ? Math.min(ELEMENT_LIMITS.radius.max, Math.round(rect.h / 2)) : radius,
    opacity,
    z,
  });
}

/** The two call-to-action pieces: a line of words, and a button whose words sit on its shape. */
function ctaBlock(c, rect) {
  const rows = rowsIn(rect, [0.9, 1.15], Math.round(rect.h * 0.1));
  const items = [];
  rows.forEach((row, index) => {
    if (index === 1) {
      items.push(
        plateItem(c, 'button-plate', row, { fill: c.palette.accent, radius: Math.min(24, Math.round(row.h / 2)), z: 5 })
      );
      items.push(
        blankItem(c, 'cta_button', 'cta_button', row, {
          style: textStyle(c, 'button', { color: c.palette.onAccent, uppercase: true, align: 'center', letterSpacing: 1 }),
          z: 12,
        })
      );
      return;
    }
    items.push(
      blankItem(c, 'cta_line', 'cta_line', row, {
        style: textStyle(c, 'body', { color: c.palette.accent, weight: c.type.subWeight }),
        z: 11,
      })
    );
  });
  return items;
}

/** A title with a short line above it, and the line under it when the content brings one. */
function titleBlock(c, rect, { includeTagline = true } = {}) {
  const keys = ['title_sub', 'headline'];
  if (includeTagline && c.hasWords('tagline')) keys.push('tagline');

  const rows = rowsIn(rect, keys.map((key) => (key === 'headline' ? 2.3 : key === 'tagline' ? 1 : 0.7)), Math.round(rect.h * 0.07));
  const items = [];
  keys.forEach((key, index) => {
    const row = rows[index];
    if (key === 'headline') {
      items.push(fieldItem(c, 'field-headline', 'headline', row, { style: textStyle(c, 'title', { color: c.titleColor }) }));
      return;
    }
    if (key === 'tagline') {
      items.push(fieldItem(c, 'field-tagline', 'tagline', row, { style: textStyle(c, 'sub', { color: c.palette.sub }) }));
      return;
    }
    items.push(
      blankItem(c, 'title_sub', key, row, {
        style: textStyle(c, 'small', { color: c.palette.accent, uppercase: true, letterSpacing: 1, weight: c.type.subWeight }),
      })
    );
  });
  return items;
}

/** The two slogan lines plus the extra lines, as one stack of words. */
function wordsBlock(c, rect) {
  const hasDetails = c.hasWords('details');
  const rows = rowsIn(
    rect,
    hasDetails ? [0.95, 0.95, 2.1] : [1, 1],
    Math.round(rect.h * 0.07)
  );
  const items = [
    blankItem(c, 'slogan_1', 'slogan_1', rows[0], {
      style: textStyle(c, 'sub', { color: c.palette.title, weight: c.type.titleWeight }),
    }),
    blankItem(c, 'slogan_2', 'slogan_2', rows[1], {
      style: textStyle(c, 'body', { color: c.palette.sub }),
    }),
  ];
  if (hasDetails) {
    items.push(fieldItem(c, 'field-details', 'details', rows[2], { style: textStyle(c, 'body', { color: c.palette.sub }) }));
  }
  return items;
}

/** The round mark a design puts its icon or picture in. */
function artBlock(c, rect) {
  if (c.options.artwork === 'none') return [];
  const items = [];
  const square = squareIn(rect);
  const photo = libraryPhoto(c.slots.imageUrl);
  const side = Math.max(ELEMENT_LIMITS.minWidth, Math.round(square.w * 0.8));
  const centered = {
    x: square.x + Math.round((square.w - side) / 2),
    y: square.y + Math.round((square.h - side) / 2),
    w: side,
    h: side,
  };

  if (photo) {
    items.push(pictureItem(c, 'art-picture', centered, photo, { radius: c.options.artwork === 'medallion' ? 64 : 12 }));
    if (c.options.artwork === 'medallion') {
      items.push(
        circleItem(c, 'art-ring', grow(square, 6), { stroke: tint(c.palette.accent, 0.4), strokeWidth: 4, fill: '', z: 5 })
      );
    }
    return items;
  }

  if (c.options.artwork === 'medallion') {
    items.push(circleItem(c, 'art-plate', square, { fill: tint(c.palette.accent, 0.72), z: 3 }));
    items.push(
      iconItem(c, 'art-icon', centered, {
        name: c.icon,
        color: shade(c.palette.accent, 0.15),
        strokeWidth: 3,
        z: 7,
      })
    );
    return items;
  }

  if (c.options.artwork === 'emblem') {
    items.push(
      iconItem(c, 'art-icon', centered, { name: c.icon, color: c.palette.accent, strokeWidth: 2, z: 7 })
    );
    return items;
  }

  /* stacked: two marks under each other with a thin rule between them. */
  const rows = rowsIn(square, [1, 0.18, 1], Math.round(square.h * 0.04));
  items.push(iconItem(c, 'art-icon', rows[0], { name: c.icon, color: c.palette.accent, z: 7 }));
  items.push(
    shapeItem(c, 'art-rule', rows[1], { fill: tint(c.palette.accent, 0.45), radius: 8, z: 4 })
  );
  items.push(iconItem(c, 'art-icon-2', rows[2], { name: 'sparkles', color: shade(c.palette.accent, 0.2), z: 7 }));
  return items;
}

function grow(rect, amount) {
  return { x: rect.x - amount, y: rect.y - amount, w: rect.w + amount * 2, h: rect.h + amount * 2 };
}

/** Faint shapes that sit behind the words: never louder than 8% and never in front. */
function decorationBlock(c, rect) {
  const kind = c.options.decoration;
  if (kind === 'none') return [];
  const fill = tint(c.palette.wash, 0.5);
  const opacity = DECORATION_MAX_OPACITY;

  if (kind === 'ring') {
    const square = squareIn(rect);
    return [circleItem(c, 'deco-ring', square, { fill, opacity, z: 0 })];
  }
  if (kind === 'dots') {
    const size = Math.max(ELEMENT_LIMITS.minWidth, Math.round(rect.w * 0.045));
    return [0, 1, 2].map((index) =>
      circleItem(c, `deco-dot-${index + 1}`, {
        x: rect.x + Math.round((rect.w - size) * (index / 2)),
        y: rect.y + rect.h - size,
        w: size,
        h: size,
      }, { fill, opacity, z: 0 })
    );
  }
  const size = Math.max(ELEMENT_LIMITS.minWidth, Math.round(rect.w * 0.06));
  const thin = Math.max(ELEMENT_LIMITS.minHeight, Math.round(size * 0.6));
  return [
    shapeItem(c, 'deco-corner-1', { x: rect.x, y: rect.y, w: size, h: thin }, { fill, opacity, z: 0 }),
    shapeItem(c, 'deco-corner-2', { x: rect.x + rect.w - size, y: rect.y, w: size, h: thin }, { fill, opacity, z: 0 }),
    shapeItem(c, 'deco-corner-3', { x: rect.x, y: rect.y + rect.h - thin, w: size, h: thin }, { fill, opacity, z: 0 }),
    shapeItem(c, 'deco-corner-4', { x: rect.x + rect.w - size, y: rect.y + rect.h - thin, w: size, h: thin }, {
      fill,
      opacity,
      z: 0,
    }),
  ];
}

/* ------------------------------------------------------------------------- *
 * Slots: the words a design is built around
 * ------------------------------------------------------------------------- */

function wordsOf(value, max) {
  return plainText(value, max);
}

/**
 * The content a recipe lays out. Only presence matters here - the words themselves never reach
 * the stored design, because the poster brings its own.
 */
export function slotsOf(slots = {}) {
  const source = slots && typeof slots === 'object' ? slots : {};
  const extras = source.extras && typeof source.extras === 'object' ? source.extras : {};
  const details = (Array.isArray(source.details) ? source.details : [])
    .map((line) => wordsOf(line, 90))
    .filter(Boolean)
    .slice(0, 4);

  const words = {
    headline: wordsOf(source.headline, 60),
    tagline: wordsOf(source.tagline, 100),
    date: wordsOf(source.date, 30),
    time: wordsOf(source.time, 20),
    venue: wordsOf(source.venue, 80),
    details,
  };
  for (const key of Object.keys(DESIGN_BLANKS)) {
    words[key] = wordsOf(extras[key], DESIGN_BLANKS[key].maxLength);
  }

  return {
    ...words,
    icon: normalizeIconName(source.icon) || '',
    imageUrl: typeof source.imageUrl === 'string' ? source.imageUrl.trim().slice(0, 600) : '',
  };
}

function optionsOf(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  const variant = RECIPE_VARIANTS.includes(Number(source.variant)) ? Number(source.variant) : 0;
  return {
    variant,
    palette: RECIPE_PALETTES.includes(source.palette) ? source.palette : RECIPE_OPTIONS_DEFAULT.palette,
    typeStyle: RECIPE_TYPE_STYLES.includes(source.typeStyle) ? source.typeStyle : RECIPE_OPTIONS_DEFAULT.typeStyle,
    decoration: RECIPE_DECORATIONS.includes(source.decoration)
      ? source.decoration
      : RECIPE_OPTIONS_DEFAULT.decoration,
    artwork: RECIPE_ARTWORKS.includes(source.artwork) ? source.artwork : RECIPE_OPTIONS_DEFAULT.artwork,
  };
}

/** Everything a block needs, worked out once per design. */
function contextOf(area, brand, slots, options) {
  const type = typeOf(options.typeStyle);
  const palette = paletteOf(brand, options.palette);
  const sizes = sizesOf(type, area.w);
  const words = slots;
  const facts = ['date', 'venue', 'time'].filter((key) => words[key]);

  return {
    area,
    brand,
    slots,
    options,
    type,
    palette,
    sizes,
    words,
    facts,
    align: options.variant % 2 === 1 ? 'center' : 'left',
    icon: words.icon || iconForCategory('general') || ICON_FALLBACK,
    titleColor: palette.title,
    factColor: palette.sub,
    /** A poster's own part is only placed when the content has words for it, so no hole shows. */
    hasWords: (key) => (key === 'details' ? words.details.length > 0 : Boolean(words[key])),
  };
}

/* ------------------------------------------------------------------------- *
 * The recipes
 * ------------------------------------------------------------------------- */

/** Rows of words, with the space handed to each block as a share of what is left. */
function compose(box, specs, gap) {
  const present = specs.filter((spec) => !spec.when || spec.when());
  if (present.length === 0) return [];
  const rows = rowsIn(box, present.map((spec) => spec.weight), gap);
  const items = [];
  present.forEach((spec, index) => {
    const made = spec.make(rows[index]);
    items.push(...(Array.isArray(made) ? made : [made]));
  });
  return items;
}

function heroRecipe(area, brandKit, slots, options = {}) {
  const brand = brandOf(brandKit);
  const opts = optionsOf(options);
  const c = contextOf(area, brand, slotsOf(slots), opts);
  const box = frameOf(area);
  const gap = Math.round(box.h * ROW_GAP_RATIO);
  const stacked = opts.variant >= 2;
  const artLeft = opts.variant % 2 === 1;

  return collect(
    c,
    compose(box, [
      {
        weight: 3.2,
        make: (rect) => titleBlock(c, rect),
      },
      {
        weight: 4.4,
        make: (rect) => {
          if (stacked) {
            const rows = rowsIn(rect, [1.5, 2.2], Math.round(rect.h * 0.06));
            return [...artBlock(c, rows[0]), ...wordsBlock(c, rows[1])];
          }
          const parts = colsIn(rect, artLeft ? [0.4, 0.6] : [0.58, 0.42], Math.round(rect.w * COL_GAP_RATIO));
          const art = artLeft ? parts[0] : parts[1];
          const words = artLeft ? parts[1] : parts[0];
          return [...artBlock(c, art), ...wordsBlock(c, words)];
        },
      },
      {
        weight: 1.6,
        when: () => c.facts.length > 0,
        make: (rect) => {
          const plate = plateItem(c, 'fact-plate', rect, { z: 2 });
          const inner = inset(rect, Math.round(rect.h * 0.42), Math.round(rect.h * 0.22));
          return [plate, ...factCells(c, inner, c.facts, { marks: c.facts.length > 1 })];
        },
      },
      {
        weight: 2,
        make: (rect) => ctaBlock(c, rect),
      },
    ], gap)
  );
}

function photoTopRecipe(area, brandKit, slots, options = {}) {
  const brand = brandOf(brandKit);
  const opts = optionsOf(options);
  const c = contextOf(area, brand, slotsOf(slots), opts);
  const box = frameOf(area);
  const gap = Math.round(box.h * ROW_GAP_RATIO);
  const factsFirst = opts.variant >= 2;

  const picture = (rect) =>
    fieldItem(c, 'field-photo', 'photo', rect, { style: { ...textStyle(c, 'body'), radius: 24, fit: 'cover' }, z: 4 });

  const blocks = [
    {
      weight: 3.4,
      make: picture,
    },
    {
      weight: 3,
      make: (rect) => titleBlock(c, rect),
    },
    {
      weight: 1.4,
      when: () => c.facts.length > 0,
      make: (rect) => factCells(c, rect, c.facts, { marks: true }),
    },
    {
      weight: 2,
      make: (rect) => wordsBlock(c, rect),
    },
    {
      weight: 2,
      make: (rect) => ctaBlock(c, rect),
    },
  ];

  /* Variants 2 and 3 lead with the date and place instead of the picture. */
  const ordered = factsFirst ? [blocks[2], ...blocks.filter((block) => block !== blocks[2])] : blocks;
  const items = collect(c, compose(box, ordered, gap));
  /* Variant 3 lets the picture run edge to edge; its row keeps the same height and place. */
  if (opts.variant === 3) {
    const art = items.find((item) => item.id === 'field-photo');
    if (art) {
      art.x = area.x;
      art.w = area.w;
      art.style.radius = 0;
    }
  }
  return items;
}

function splitPhotoRecipe(area, brandKit, slots, options = {}) {
  const brand = brandOf(brandKit);
  const opts = optionsOf(options);
  const c = contextOf(area, brand, slotsOf(slots), opts);
  const box = frameOf(area);
  const gap = Math.round(box.h * ROW_GAP_RATIO);
  const sideways = opts.variant < 2;
  const secondSide = opts.variant % 2 === 1;

  const wordsCol = (rect) =>
    compose(
      rect,
      [
        { weight: 3, make: (r) => titleBlock(c, r) },
        {
          weight: 1.4,
          when: () => c.facts.length > 0,
          make: (r) => factCells(c, r, c.facts, { marks: true }),
        },
        { weight: 2.4, make: (r) => wordsBlock(c, r) },
        { weight: 1.8, make: (r) => ctaBlock(c, r) },
      ],
      Math.round(rect.h * ROW_GAP_RATIO)
    );

  const parts = sideways
    ? colsIn(box, [0.44, 0.56], Math.round(box.w * COL_GAP_RATIO))
    : rowsIn(box, [0.4, 0.6], gap);
  const artIndex = secondSide ? 1 : 0;
  const art = parts[artIndex];
  const words = parts[secondSide ? 0 : 1];

  const items = collect(c, [
    fieldItem(c, 'field-photo', 'photo', art, { style: { ...textStyle(c, 'body'), radius: 24, fit: 'cover' }, z: 4 }),
    ...wordsCol(words),
  ]);
  if (opts.variant === 3) {
    const iconSize = Math.max(ELEMENT_LIMITS.minWidth, Math.round(Math.min(art.w, art.h) * 0.3));
    items.push(
      iconItem(c, 'art-icon', {
        x: art.x + Math.round((art.w - iconSize) / 2),
        y: art.y + Math.round((art.h - iconSize) / 2),
        w: iconSize,
        h: iconSize,
      }, { name: c.icon, color: c.palette.accent, z: 8 })
    );
  }
  return items;
}

function typographicRecipe(area, brandKit, slots, options = {}) {
  const brand = brandOf(brandKit);
  const opts = optionsOf(options);
  const c = contextOf(area, brand, slotsOf(slots), opts);
  const box = frameOf(area);
  const gap = Math.round(box.h * ROW_GAP_RATIO);

  return collect(
    c,
    compose(box, [
      {
        weight: 1.3,
        when: () => c.options.artwork !== 'none',
        make: (rect) => artBlock(c, rect),
      },
      {
        weight: 3.6,
        make: (rect) => titleBlock(c, rect),
      },
      {
        weight: 0.3,
        when: () => true,
        make: (rect) => {
          const rule = { ...rect, h: Math.max(ELEMENT_LIMITS.minHeight, Math.round(rect.h * 0.5)) };
          return shapeItem(c, 'title-rule', rule, { fill: c.palette.accent, radius: 8, z: 3 });
        },
      },
      {
        weight: 1.6,
        when: () => c.facts.length > 0,
        make: (rect) => factCells(c, rect, c.facts, { marks: true }),
      },
      {
        weight: 2.6,
        make: (rect) => wordsBlock(c, rect),
      },
      {
        weight: 2,
        make: (rect) => ctaBlock(c, rect),
      },
    ], gap)
  );
}

function boldBandRecipe(area, brandKit, slots, options = {}) {
  const brand = brandOf(brandKit);
  const opts = optionsOf(options);
  const c = contextOf(area, brand, slotsOf(slots), opts);
  const box = frameOf(area);
  const gap = Math.round(box.h * ROW_GAP_RATIO);
  const full = opts.variant >= 2;

  /* The band is the one block that owns its words' colour: light or ink, whichever reads. */
  const band = { ...c, titleColor: c.palette.onBand, factColor: c.palette.onBand };
  band.align = 'left';

  const specs = [
    {
      weight: 3.4,
      make: (rect) => {
        const plate = shapeItem(c, 'title-band', rect, {
          fill: c.palette.band,
          radius: full ? 0 : 16,
          z: 2,
        });
        const inner = inset(rect, Math.round(rect.w * 0.05), Math.round(rect.h * 0.1));
        const parts =
          c.options.artwork === 'none'
            ? [inner, null]
            : colsIn(inner, [0.72, 0.28], Math.round(inner.w * 0.03));
        const title = titleBlock(band, parts[0]);
        const art = parts[1] ? artBlock({ ...band, align: 'center' }, parts[1]) : [];
        return [plate, ...title, ...art];
      },
    },
    {
      weight: 1.6,
      when: () => c.facts.length > 0,
      make: (rect) => factCells(c, rect, c.facts, { marks: true }),
    },
    {
      weight: 2.4,
      make: (rect) => wordsBlock(c, rect),
    },
    {
      weight: 2,
      make: (rect) => ctaBlock(c, rect),
    },
  ];

  /* Variants 1 and 3 put the date and place above the band. */
  const ordered =
    opts.variant % 2 === 1 ? [specs[1], specs[0], specs[2], specs[3]] : specs;
  const items = collect(c, compose(box, ordered, gap));
  /* Variants 2 and 3 run the band edge to edge; its row keeps its own height and place. */
  if (full) {
    const plate = items.find((item) => item.id === 'title-band');
    if (plate) {
      plate.x = area.x;
      plate.w = area.w;
    }
  }
  return items;
}

/** Decorations go behind the design; the id prefix keeps every name unique in one design. */
function collect(c, items) {
  const area = c.area;
  const list = Array.isArray(items) ? items : [];
  const extras = decorationBlock(c, area);
  const merged = [...extras, ...list].map((item) => ({
    ...item,
    ...clampRectToArea({ x: item.x, y: item.y, w: item.w, h: item.h }, area),
  }));
  return merged.slice(0, ELEMENT_LIMITS.maxItems);
}

/* ------------------------------------------------------------------------- *
 * The recipe list
 * ------------------------------------------------------------------------- */

export const DESIGN_RECIPES = [
  {
    id: 'hero',
    name: 'Big title with a round mark',
    suits: ['festival', 'celebration', 'sports', 'corporate', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: heroRecipe,
  },
  {
    id: 'photoTop',
    name: 'Photo on top',
    suits: ['health', 'awareness', 'education', 'corporate', 'general'],
    needsPhoto: true,
    recipeVersion: RECIPE_VERSION,
    recipe: photoTopRecipe,
  },
  {
    id: 'splitPhoto',
    name: 'Photo beside the words',
    suits: ['health', 'education', 'meeting', 'corporate', 'notice', 'general'],
    needsPhoto: true,
    recipeVersion: RECIPE_VERSION,
    recipe: splitPhotoRecipe,
  },
  {
    id: 'typographic',
    name: 'Words only',
    suits: ['notice', 'meeting', 'awareness', 'corporate', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: typographicRecipe,
  },
  {
    id: 'boldBand',
    name: 'Title on a bold band',
    suits: ['festival', 'celebration', 'sports', 'education', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: boldBandRecipe,
  },
];

/** Ids keep their capitals (photoTop), so the match ignores case only. */
export function designById(id) {
  const wanted = typeof id === 'string' ? id.trim().toLowerCase() : '';
  return DESIGN_RECIPES.find((design) => design.id.toLowerCase() === wanted) || null;
}

export function recipeIds() {
  return DESIGN_RECIPES.map((design) => design.id);
}

/** Designs that suit a kind of event; every design when nothing suits it. */
export function designsFor(category) {
  const wanted = typeof category === 'string' ? category.trim().toLowerCase() : '';
  const suited = DESIGN_RECIPES.filter((design) => design.suits.includes(wanted));
  return suited.length > 0 ? suited : DESIGN_RECIPES.slice();
}

export function suitsCategory(id, category) {
  const design = designById(id);
  if (!design) return false;
  return design.suits.includes(typeof category === 'string' ? category.trim().toLowerCase() : '');
}

/**
 * Builds one design's items. `area` may be given directly, or worked out from a brand kit and a
 * poster size. The answer is already normalised, so what a recipe returns is what a template
 * stores.
 */
export function buildElements(id, { area, brandKit = null, template = null, size = null, slots = {}, options = {} } = {}) {
  const design = designById(id);
  if (!design) return { elements: [], problems: [`"${id}" is not a design this app knows.`] };
  const box = area || contentArea(brandKit, template || { size });
  const opts = optionsOf(options);
  const elements = design.recipe(box, brandKit, slots, opts);
  return { elements: normalizeElements(elements), problems: [], design, options: opts };
}
