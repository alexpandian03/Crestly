/**
 * Design recipes: how a poster's items are put together.
 *
 * Same rules as /shared/templateElements.js: plain ESM, no environment reads, no Node-only or
 * browser-only APIs, nothing that draws. A recipe only returns items in the format the template
 * editor already stores, so the server can save them, check them with the same function the
 * browser uses, and the browser can render them without knowing a recipe ever existed.
 *
 * Every colour comes out of the brand kit through tint()/shade(); a recipe never invents one, and
 * words are only ever painted in a colour that reads against what is actually behind them.
 * The header and footer belong to the brand kit, so a recipe only ever works inside the
 * content area it is handed.
 *
 * A design is built around the words it was given: every box of words is as tall as the words
 * need at the size chosen for them, so nothing is cut off and the blocks fill the poster from
 * the top band to the bottom one without a hole in it.
 */
import {
  ELEMENT_FONTS,
  ELEMENT_LIMITS,
  ICON_FALLBACK,
  ICON_STROKE_DEFAULT,
  RULE_THICKNESS,
  VARIABLE_LIMITS,
  clampRectToArea,
  contentArea,
  iconForWords,
  normalizeElements,
  normalizeHexColor,
  normalizeIconName,
  plainText,
} from './templateElements.js';

/** Bumped whenever a recipe's shape changes, so a poster can keep the look it was made with. */
export const RECIPE_VERSION = 2;

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

/* The one type system: five roles, and a design uses no more than five of them. */
export const TYPE_ROLES = ['heading', 'lead', 'strong', 'regular', 'button'];
/** At most this many ways of setting words on one poster, and this many boxes of written words. */
export const MAX_TYPE_STYLES = 5;
export const MAX_TEXT_BOXES = 7;
/** The hero pattern: title, two slogan lines, three facts, a call and a button - nine boxes. */
export const MAX_HERO_WORD_BOXES = 9;

/* ------------------------------------------------------------------------- *
 * Rhythm: one spacing unit for every gap on the poster
 * ------------------------------------------------------------------------- */

/** The poster width this spacing was authored for. */
export const SPACING_REFERENCE_WIDTH = 1080;
/** 24 poster pixels between blocks on a 1080-wide poster, and one quarter of that inside a block. */
export const SPACING_UNIT = 24;

/** The vertical rhythm for a poster of this width. */
export function spacingUnit(width) {
  const value = Math.round((SPACING_UNIT * Math.max(1, Number(width) || 0)) / SPACING_REFERENCE_WIDTH);
  return Math.min(48, Math.max(8, value || SPACING_UNIT));
}

/**
 * How wide one character of a typeface is, on average.
 *
 * The recipes cannot measure real glyphs, so every box they cut is worked out from this estimate
 * and the poster's own auto-fit does the rest. 0.58 is the usual ratio between a font's size and
 * the width of its lower-case letters.
 */
export const ESTIMATED_CHAR_WIDTH = 0.58;
/** A title never needs more than this many lines; it is set smaller until it fits in them. */
export const TITLE_MAX_LINES = 2;
/** A word this colour must stand out from what is behind it by at least this much. */
export const TEXT_CONTRAST_MIN = 4.5;
/** How tall a divider is inside an info pill, as a share of the pill. */
export const PILL_DIVIDER_RATIO = 0.55;
/** How much of the line the title may keep to itself. */
const TITLE_LINE_SHARE = 0.46;
/* The same multiples the poster's own bullet list and icon rows use, so the estimate is honest. */
const BULLET_MARK = 0.34;
const BULLET_INK = 0.28;
const BULLET_ROW_GAP = 0.5;
const ICON_SIZE = 1.15;
const ICON_GAP = 0.4;
const FACT_FIELDS = ['date', 'venue', 'time'];
/** A fact column narrower than this reads better on its own line than squeezed next to two others. */
const MIN_CELL_WIDTH = 190;
/** A fact may take at most this many lines in its own column before the three of them go one
 *  under another instead. Three columns on one row is the shape a pill has, so a fact is allowed
 *  to wrap a little before that shape is given up. */
const FACT_CELL_MAX_LINES = 3;
/** The narrowest strip a line of words can be measured in. */
const MIN_TEXT_WIDTH = 8;

const MARGIN_RATIO = 0.062;
const COL_GAP_RATIO = 0.028;

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

/** The words a design may give up when the poster is too full, least important first. These are
 *  the line keys `line()` gives its entries, plus the block key of the round mark. */
const DROP_ORDER = ['title_sub', 'slogan_2', 'details', 'cta_line', 'tagline', 'artwork', 'photo'];
/** Tried in order before anything is given up, so the words keep their lines. A poster with room
 *  to spare is set larger first, so its blocks reach from the top band to the bottom one. */
const SCALES = [1.6, 1.45, 1.3, 1.15, 1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52];

/* ------------------------------------------------------------------------- *
 * Colour: everything comes from the brand kit
 * ------------------------------------------------------------------------- */

function numberOr(value, fallback) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function toIntOr(value, fallback = 0) {
  return Math.round(numberOr(value, fallback));
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

/**
 * How bright a colour is to an eye, 0..1 - the WCAG relative luminance.
 *
 * A pure function of the hex, so the server, the browser and a test all agree on it.
 */
export function relativeLuminance(color) {
  const rgb = toRgb(color);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast between two colours: 1 means indistinguishable, 21 is black on white. */
export function contrastRatio(a, b) {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const high = Math.max(first, second);
  const low = Math.min(first, second);
  return (high + 0.05) / (low + 0.05);
}

/* Rough perceptual brightness, used only to choose which brand colour reads on a surface. */
function isLight(color) {
  return toRgb(color) ? relativeLuminance(color) > 0.4 : true;
}

/**
 * The first of `candidates` a person can read on `fill`.
 *
 * The order is the preference: a design asks with the brand's own words colours first, so the
 * poster keeps its voice. Nothing here invents a colour - every candidate handed in is a brand
 * colour or one mixing toward white or black.
 */
export function readableColorOn(fill, candidates, min = TEXT_CONTRAST_MIN) {
  const list = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
  let best = '';
  let bestRatio = -1;
  for (const color of list) {
    const ratio = contrastRatio(color, fill);
    if (ratio >= min) return color;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = color;
    }
  }
  return best;
}

/**
 * Pick the best readable color from candidates against a background (WCAG contrast).
 */
export function pickReadableColor(candidates, background, min = TEXT_CONTRAST_MIN) {
  return readableColorOn(background, candidates, min);
}

/**
 * What a design assumes it is writing on: the brand's own background plate.
 *
 * The poster paints its surface from the brand kit, which a recipe may not read beyond the six
 * colours and two fonts `brandOf` allows, so this is the one honest answer.
 */
export function posterSurface(brandKit) {
  const kit = brandKit && typeof brandKit === 'object' && !Array.isArray(brandKit) ? brandKit : {};
  return colorOf(kit.colors?.background) || brandOf(kit).dark;
}

/** One colour seen through another's see-through amount, over an opaque surface. */
function over(fill, surface, opacity = 1) {
  const from = toRgb(fill);
  if (!from) return colorOf(surface) || BRAND_DEFAULTS.background;
  const strength = clamp(numberOr(opacity, 1), 0, 1);
  const base = toRgb(surface) || [255, 255, 255];
  return toHex(base.map((value, index) => value + (from[index] - value) * strength));
}

/** True for an item the poster paints words into. */
function drawsWords(item) {
  if (!item) return false;
  if (item.kind === 'text') return true;
  return item.kind === 'field' && ['headline', 'tagline', 'date', 'time', 'venue', 'details'].includes(item.field);
}

/** True for the shape a set of words stands on: a pill, a button, a band. */
function isPlate(item) {
  const fill = item?.shape?.fill;
  return item?.kind === 'shape' && item?.shape?.type === 'rect' && Boolean(fill) && fill !== 'transparent';
}

function covers(outer, inner, tolerance = 2) {
  return (
    outer.x - tolerance <= inner.x &&
    outer.y - tolerance <= inner.y &&
    outer.x + outer.w + tolerance >= inner.x + inner.w &&
    outer.y + outer.h + tolerance >= inner.y + inner.h
  );
}

/**
 * The colour really behind one item's words: its plate's fill, or the poster's own surface.
 *
 * The same rule the browser follows when it checks a colour - the topmost filled shape that
 * holds the box completely, painted through its own see-through amount.
 */
export function backdropOf(item, items, surface = '') {
  const list = Array.isArray(items) ? items : [];
  let best = null;
  for (const plate of list) {
    if (!isPlate(plate) || plate === item || !(plate.z < item.z) || !covers(plate, item)) continue;
    if (!best || best.z < plate.z) best = plate;
  }
  if (!best) return colorOf(surface) || colorOf(BRAND_DEFAULTS.background);
  return over(best.shape.fill, surface, best.style?.opacity);
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
 * Standard brand tokens extracted from the brand kit:
 * primary, dark, accent, text, background, headingFont, bodyFont.
 */
export function brandTokensOf(brandKit) {
  const b = brandOf(brandKit);
  const kit = brandKit && typeof brandKit === 'object' && !Array.isArray(brandKit) ? brandKit : {};
  const colors = kit.colors && typeof kit.colors === 'object' ? kit.colors : {};
  const bg = colorOf(colors.background, '#FFFFFF');
  const txt = colorOf(colors.text, BRAND_DEFAULTS.text);
  return {
    primary: b.primary,
    dark: b.secondary || b.dark || '#0F172A',
    accent: b.accent,
    text: txt,
    background: bg,
    headingFont: b.headingFont,
    bodyFont: b.bodyFont,
  };
}

/** Every colour a design may write words in, in the order it prefers them. */
function inkOptions(brand) {
  return [brand.ink, brand.body, brand.light, tint(brand.primary, 0.85), shade(brand.primary, 0.55), '#ffffff', '#000000'];
}

/**
 * The one contrast gate every design passes through on its way out.
 *
 * A recipe colours its words from the brand as it sees them; this then checks each of them
 * against what is really behind it - a pill, a button, a band, the poster's own plate - and
 * exchanges only the ones a person could not read. Shapes, pictures and marks are left alone:
 * the accent colour is there to be seen, not to be read.
 */
export function readableInks(items, { surface = '', candidates = [], min = TEXT_CONTRAST_MIN } = {}) {
  const list = Array.isArray(items) ? items : [];
  const inks = candidates.length > 0 ? candidates : inkOptions(brandOf(null));
  return list.map((item) => {
    if (!drawsWords(item)) return item;
    const backdrop = backdropOf(item, list, surface);
    if (contrastRatio(item.style?.color, backdrop) >= min) return item;
    const color = readableColorOn(backdrop, inks, min);
    if (!color || color === item.style?.color) return item;
    return { ...item, style: { ...item.style, color } };
  });
}

/**
 * Which brand colour plays which role. Four palettes, all reading the same six brand colours in
 * a different order, so a design changes mood without ever leaving the brand. Only the accent
 * the shapes wear and the band a pill or a plate is filled with move between palettes; the words
 * always take a readable brand ink.
 */
const PALETTES = {
  brand: (b) => ({
    accent: b.primary,
    band: tint(b.primary, 0.88),
  }),
  bright: (b) => ({
    accent: b.accent,
    band: tint(b.accent, 0.82),
  }),
  deep: (b) => ({
    accent: shade(b.primary, 0.15),
    band: shade(b.primary, 0.2),
  }),
  duo: (b) => ({
    accent: b.primary,
    band: b.secondary,
  }),
};

function paletteOf(brand, name) {
  const make = PALETTES[RECIPE_PALETTES.includes(name) ? name : RECIPE_OPTIONS_DEFAULT.palette];
  const roles = make(brand);
  return {
    primary: brand.primary,
    ...roles,
    /* The edge of a plate and the wash of a decoration: the same brand colours, softer. */
    edge: brand.line,
    wash: roles.accent,
  };
}

/* ------------------------------------------------------------------------- *
 * Words: how much room a set of them needs
 * ------------------------------------------------------------------------- */

/** How wide one character really is for this setting of the type. */
export function charWidthOf(size, { weight = 400, uppercase = false, letterSpacing = 0 } = {}) {
  const base = Math.max(1, numberOr(size, MIN_RECIPE_FONT)) * ESTIMATED_CHAR_WIDTH;
  const heavy = toIntOr(weight, 400) >= 700 ? 1.06 : 1;
  const caps = uppercase ? 1.1 : 1;
  return base * heavy * caps + Math.max(0, numberOr(letterSpacing, 0));
}

/** How many characters fit on one line of this box at this size. */
export function charsPerLine(width, size, face = {}) {
  return Math.max(1, Math.floor(Math.max(MIN_TEXT_WIDTH, numberOr(width, 1)) / charWidthOf(size, face)));
}

/**
 * How many lines a set of words takes.
 *
 * Words move whole to the next line without breaking mid-word (wrap on spaces only).
 */
export function linesOfWords(text, width, size, face = {}) {
  const per = charsPerLine(width, size, face);
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 1;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    if (used > 0) {
      if (used + 1 + word.length <= per) {
        used += 1 + word.length;
        continue;
      }
      lines += 1;
      used = 0;
    }
    used = word.length;
  }
  return lines;
}

/** Shrink font size (down to minSize, min 22px) so long single words never overflow or break mid-word. */
export function fitWordSize(text, width, initialSize, face = {}, minSize = 22) {
  let size = Math.max(minSize, initialSize);
  const words = (Array.isArray(text) ? text.join(' ') : String(text ?? ''))
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return size;
  const maxWordLen = Math.max(...words.map((w) => w.length));
  let iter = 0;
  const startTime = Date.now();
  while (
    size > minSize &&
    iter < 200 &&
    Date.now() - startTime <= 1500 &&
    Math.ceil(maxWordLen * charWidthOf(size, face)) > width
  ) {
    iter += 1;
    size = Math.max(minSize, size - 1);
  }
  return size;
}

/** How much room the mark beside a fact takes off its line. */
function iconRoomOf(style, size) {
  if (style?.showIcon === false) return 0;
  return Math.round(size * ICON_SIZE) + Math.max(2, Math.round(size * ICON_GAP));
}

/**
 * The height a box of words needs, in poster pixels.
 *
 * Give it the item as it will be stored and the words as the poster will bring them. A list of
 * extra lines is measured line by line, with the room its marks take and the gaps between rows.
 */
export function estimatedTextHeight(item, words = '') {
  const style = (item && item.style) || {};
  const size = Math.max(1, toIntOr(style.size, MIN_RECIPE_FONT));
  const lineHeight = numberOr(style.lineHeight, 1.2);
  const face = { weight: style.weight, uppercase: style.uppercase, letterSpacing: style.letterSpacing };
  const box = Math.max(MIN_TEXT_WIDTH, toIntOr(item?.w, ELEMENT_LIMITS.minWidth));
  if (Array.isArray(words)) {
    const lines = words.filter(Boolean);
    if (lines.length === 0) return 0;
    const mark = Math.max(3, Math.round(size * BULLET_MARK));
    const width = Math.max(MIN_TEXT_WIDTH, box - mark * 2 - Math.round(size * BULLET_INK));
    const body = lines.reduce((acc, line) => acc + linesOfWords(line, width, size, face) * size * lineHeight, 0);
    return Math.round(body + (lines.length - 1) * Math.round(size * BULLET_ROW_GAP));
  }
  const text = String(words ?? '').trim();
  if (!text) return 0;
  const width = box - (item?.kind === 'field' && FACT_FIELDS.includes(item.field) ? iconRoomOf(style, size) : 0);
  return Math.round(linesOfWords(text, Math.max(MIN_TEXT_WIDTH, width), size, face) * size * lineHeight);
}

/**
 * The size a title is set at: as large as the design wants, until the words need more than two
 * lines of the space the title owns.
 *
 * `room` is the height the title block has for its own lines, so a very long title is written
 * smaller rather than left to hang over the rest of the poster.
 */
export function fitTextSize({
  text = '',
  width,
  size,
  min = MIN_RECIPE_FONT,
  lineHeight = 1.05,
  maxLines = TITLE_MAX_LINES,
  room = 0,
  face = {},
} = {}) {
  const floor = Math.max(MIN_RECIPE_FONT, toIntOr(min, MIN_RECIPE_FONT));
  const cap = Math.max(floor, toIntOr(size, floor));
  let chosen = cap;
  const startTime = Date.now();
  for (let step = 0; step < 200; step += 1) {
    if (Date.now() - startTime > 1500) break;
    const lines = linesOfWords(text, width, chosen, face);
    const height = lines * chosen * numberOr(lineHeight, 1.05);
    if (lines <= maxLines && (!room || height <= room)) break;
    const next = chosen - Math.max(1, Math.round(chosen * 0.06));
    if (next <= floor) {
      chosen = floor;
      break;
    }
    chosen = next;
  }
  return chosen;
}

/* ------------------------------------------------------------------------- *
 * Type
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

/**
 * The five sizes of one design, from the poster's own width and height.
 *
 * The title starts no taller than a fifth of the space between the bands, so a short title on a
 * wide poster still leaves room for the rest of it.
 */
function sizesOf(type, width, height, scale = 1) {
  const start = Math.min(
    Math.max(MIN_RECIPE_FONT, Math.round(width * 0.085 * type.scale)),
    Math.max(MIN_RECIPE_FONT * 2, Math.round(height * 0.2))
  );
  const heading = Math.max(MIN_RECIPE_FONT, Math.round(start * scale));
  const sub = Math.max(MIN_RECIPE_FONT, Math.round(heading / type.ratio));
  const body = Math.max(MIN_RECIPE_FONT, Math.round(sub * 0.85));
  return {
    heading,
    strong: sub,
    regular: body,
    lead: Math.max(MIN_RECIPE_FONT, Math.round(body * 0.82)),
    button: Math.max(MIN_RECIPE_FONT, Math.round(body * 1.05)),
  };
}

/** What each role looks like: the typeface, weight, capitals and leading of one kind of line. */
const ROLE_LOOK = {
  heading: (c) => ({
    fontFamily: c.brand.headingFont,
    weight: c.type.titleWeight,
    letterSpacing: c.type.letterSpacing,
    uppercase: c.type.uppercase,
    lineHeight: 1.05,
  }),
  lead: (c) => ({
    fontFamily: c.brand.bodyFont,
    weight: c.type.subWeight,
    letterSpacing: 1,
    uppercase: true,
    lineHeight: 1.2,
  }),
  strong: (c) => ({
    fontFamily: c.brand.bodyFont,
    weight: c.type.titleWeight,
    letterSpacing: 0,
    uppercase: false,
    lineHeight: 1.25,
  }),
  regular: (c) => ({
    fontFamily: c.brand.bodyFont,
    weight: c.type.subWeight,
    letterSpacing: 0,
    uppercase: false,
    lineHeight: 1.3,
  }),
  button: () => ({ fontFamily: '', weight: 700, letterSpacing: 1, uppercase: true, lineHeight: 1.15 }),
};

/**
 * The look of one line of words.
 *
 * Only the colour, the alignment and the title's own size move from line to line, so a design
 * never paints more than these five ways of setting words.
 */
function textStyle(c, role, extra = {}) {
  const look = ROLE_LOOK[TYPE_ROLES.includes(role) ? role : 'regular'](c);
  const size = Math.max(MIN_RECIPE_FONT, toIntOr(extra.size ?? c.sizes[role] ?? c.sizes.regular, MIN_RECIPE_FONT));
  return {
    fontFamily: extra.fontFamily || look.fontFamily || c.brand.bodyFont,
    size,
    /* Room for the poster's own auto-fit: a box may need half its chosen size. */
    minSize: Math.max(MIN_RECIPE_FONT, Math.min(size, Math.round(size * 0.55))),
    weight: toIntOr(extra.weight ?? look.weight, 500),
    color: extra.color || readableColorOn(extra.fill ?? c.surface, c.inks),
    align: extra.align || c.align,
    lineHeight: numberOr(extra.lineHeight ?? look.lineHeight, 1.2),
    letterSpacing: toIntOr(extra.letterSpacing ?? look.letterSpacing, 0),
    uppercase: extra.uppercase ?? look.uppercase,
    italic: Boolean(extra.italic),
    opacity: 1,
    ...(extra.showIcon === undefined ? {} : { showIcon: extra.showIcon }),
    showLabel: false,
  };
}

/** One way of setting words, counted by the poster's own face rather than by its colour. */
export function typeSignatureOf(item) {
  const style = (item && item.style) || {};
  return [style.fontFamily, style.size, style.weight, style.letterSpacing, style.uppercase ? 1 : 0].join('|');
}

/** Every distinct way words are set in a design. */
export function distinctTypeStyles(items) {
  const found = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    if (drawsWords(item)) found.add(typeSignatureOf(item));
  }
  return [...found];
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

/** How thick a drawn rule is: three poster pixels at 1080 wide, and never more than four. */
export function ruleThicknessOf(width) {
  return clamp(Math.round((3 * Math.max(1, numberOr(width, 1080))) / SPACING_REFERENCE_WIDTH), RULE_THICKNESS.min, 4);
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
  const side = Math.max(1, Math.min(rect.w, rect.h));
  return boxOf({
    x: rect.x + (rect.w - side) / 2,
    y: rect.y + (rect.h - side) / 2,
    w: side,
    h: side,
  });
}

function grow(rect, amount) {
  return { x: rect.x - amount, y: rect.y - amount, w: rect.w + amount * 2, h: rect.h + amount * 2 };
}

/* ------------------------------------------------------------------------- *
 * Item builders - the shared element format, nothing else
 * ------------------------------------------------------------------------- */

/** A rule is a mark, not a box of words, so it keeps the thin size it was drawn at. */
function minBox(rect, area) {
  const thin =
    rect.w <= RULE_THICKNESS.max || rect.h <= RULE_THICKNESS.max
      ? Math.max(rect.w, rect.h) >= Math.min(rect.w, rect.h) * RULE_THICKNESS.ratio
      : false;
  const fixed = thin
    ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
    : {
        x: rect.x,
        y: rect.y,
        w: Math.max(ELEMENT_LIMITS.minWidth, rect.w),
        h: Math.max(ELEMENT_LIMITS.minHeight, rect.h),
      };
  return clampRectToArea(fixed, area);
}

function makeItem(c, id, kind, rect, { style, z = 10, locked = false, rest } = {}) {
  return {
    id,
    kind,
    ...minBox(boxOf(rect), c.area),
    z,
    locked: Boolean(locked),
    style: style || textStyle(c, 'regular'),
    ...(rest || {}),
  };
}

/** One of the poster's own parts: the words come from the poster, not from the design. */
function fieldItem(c, field, rect, { style, z = 10, imageUrl = '' } = {}) {
  const item = makeItem(c, `field-${field}`, 'field', rect, { style: style || textStyle(c, 'regular'), z });
  item.field = field;
  item.text = '';
  if (field === 'photo') item.imageUrl = imageUrl;
  return item;
}

/** A fill-in blank: the assistant writes it, then the person making the poster can change it. */
function blankItem(c, key, rect, { style, z = 11 } = {}) {
  const blank = DESIGN_BLANKS[key] || { label: key, hint: '', maxLength: VARIABLE_LIMITS.maxLength.default };
  const item = makeItem(c, key, 'text', rect, { style: style || textStyle(c, 'regular'), z });
  item.text = '';
  item.variable = true;
  item.key = key;
  item.label = blank.label;
  item.hint = blank.hint;
  item.maxLength = blank.maxLength;
  return item;
}

function textItem(c, id, text, rect, { style, z = 10 } = {}) {
  const item = makeItem(c, id, 'text', rect, { style: style || textStyle(c, 'regular'), z });
  item.text = text;
  item.variable = false;
  return item;
}

function shapeItem(c, id, rect, { fill = '', stroke = '', strokeWidth = 0, radius = 0, opacity = 1, z = 2 } = {}) {
  /* A shape paints from its own fill and stroke; the style colour only carries the brand edge
     colour so the item never asks for a colour the brand kit does not have. */
  const style = { ...textStyle(c, 'regular'), color: c.palette.edge, opacity, radius };
  const item = makeItem(c, id, 'shape', rect, { style, z });
  item.shape = { type: 'rect', fill, stroke, strokeWidth };
  return item;
}

function circleItem(c, id, rect, { fill = '', stroke = '', strokeWidth = 0, opacity = 1, z = 2 } = {}) {
  const item = shapeItem(c, id, rect, { fill, stroke, strokeWidth, opacity, z });
  item.shape.type = 'circle';
  return item;
}

function iconItem(c, id, rect, { name, color, strokeWidth = ICON_STROKE_DEFAULT, opacity = 1, z = 6 } = {}) {
  const style = { ...textStyle(c, 'regular'), color: color || c.palette.accent, opacity, strokeWidth };
  const item = makeItem(c, id, 'icon', rect, { style, z });
  item.name = normalizeIconName(name) || ICON_FALLBACK;
  return item;
}

/** An artwork picture of its own, kept only when it comes from this app's image library. */
function libraryPhoto(url) {
  const value = typeof url === 'string' ? url.trim().slice(0, 600) : '';
  return /^https:\/\/res\.cloudinary\.com\//i.test(value) ? value : '';
}

function pictureItem(c, id, rect, url, { radius = 24, z = 4 } = {}) {
  const style = { ...textStyle(c, 'regular'), radius, fit: 'cover' };
  const item = makeItem(c, id, 'image', rect, { style, z });
  item.imageUrl = url;
  return item;
}

/* ------------------------------------------------------------------------- *
 * Lines and blocks of words
 * ------------------------------------------------------------------------- */

/**
 * One line of the design's own, described once so its height and the box it is placed in can
 * never disagree: the same words, the same role and the same width measure it and paint it.
 */
function line(spec) {
  return {
    key: spec.key,
    role: spec.role || 'regular',
    blank: spec.blank || '',
    field: spec.field || '',
    look: spec.look || {},
    /** The words the poster will bring for this line. */
    words: spec.words,
    /** A line may ask for a smaller size than its role (only the title ever does). */
    fit: spec.fit || null,
    min: spec.min || 0,
  };
}

function resolveLine(c, entry, width) {
  const words = entry.words(c);
  const look = ROLE_LOOK[entry.role](c);
  const styleLook = { ...look, ...entry.look };
  const face = {
    weight: toIntOr(styleLook.weight, 500),
    uppercase: Boolean(styleLook.uppercase),
    letterSpacing: toIntOr(styleLook.letterSpacing, 0),
  };
  const listed = Array.isArray(words) ? words.filter(Boolean) : String(words || '').trim();
  let size = entry.fit
    ? entry.fit(c, words, width, face, styleLook)
    : Math.max(MIN_RECIPE_FONT, toIntOr(c.sizes[entry.role], MIN_RECIPE_FONT));
  size = fitWordSize(listed, width, size, face, 22);
  const style = textStyle(c, entry.role, { ...entry.look, size });
  const box = { kind: entry.field ? 'field' : 'text', field: entry.field, w: width, style };
  const height = estimatedTextHeight(box, listed);
  return { style, height: Math.max(entry.min || ELEMENT_LIMITS.minHeight, height) };
}

/** A box of the poster's own words. */
function fieldLine(key, field, role, extra = {}) {
  return line({
    key,
    field,
    role,
    look: extra.look || {},
    words: (c) => (field === 'details' ? c.words.details : c.words[field]),
  });
}

/** A box somebody fills in later. */
function blankLine(key, role, extra = {}) {
  return line({ key, blank: key, role, look: extra.look || {}, words: (c) => c.words[key] });
}

/** The headline: the one line whose size is worked out from its own words. */
function headlineLine(room) {
  return line({
    key: 'headline',
    field: 'headline',
    role: 'heading',
    min: MIN_RECIPE_FONT,
    words: (c) => c.words.headline,
    fit: (c, text, width, face, look) =>
      fitTextSize({
        text,
        width,
        size: c.sizes.heading,
        min: MIN_RECIPE_FONT,
        lineHeight: numberOr(look.lineHeight, 1.05),
        maxLines: TITLE_MAX_LINES,
        room,
        face,
      }),
  });
}

function isDropped(c, key) {
  if (c.dropped.has(key)) return true;
  if ((key === 'kicker' || key === 'badge' || key === 'overline') && c.dropped.has('title_sub')) return true;
  if (key === 'schedule' && c.dropped.has('details')) return true;
  return false;
}

function hasEntryText(c, entry) {
  if (!entry) return false;
  if (isDropped(c, entry.key)) return false;
  const words = entry.words ? entry.words(c) : c.words[entry.key || entry.field];
  if (Array.isArray(words)) return words.filter(Boolean).length > 0;
  return Boolean(String(words || '').trim());
}

/** How tall a group of lines is, with the smaller gap that belongs inside one block. */
function groupHeight(c, entries, width, innerGapOverride = 0) {
  const kept = entries.filter((entry) => hasEntryText(c, entry));
  if (kept.length === 0) return 0;
  const gap = Math.max(16, innerGapOverride || c.inner);
  const heights = kept.map((entry) => resolveLine(c, entry, width).height);
  return heights.reduce((acc, height) => acc + height, 0) + gap * (kept.length - 1);
}

/** Place a group of lines in a box, top-down, optionally held in its middle. */
function groupLines(c, entries, rect, { centre = false, innerGap = 0 } = {}) {
  const kept = entries.filter((entry) => hasEntryText(c, entry));
  if (kept.length === 0) return [];
  const gap = Math.max(16, innerGap || c.inner);
  const resolved = kept.map((entry) => ({ entry, ...resolveLine(c, entry, rect.w) }));
  const heights = resolved.map((item) => item.height);
  const used = heights.reduce((acc, height) => acc + height, 0) + gap * (kept.length - 1);
  let cursor = rect.y + (centre ? Math.max(0, Math.round((rect.h - used) / 2)) : 0);
  const items = [];
  resolved.forEach((row, index) => {
    const box = { x: rect.x, y: cursor, w: rect.w, h: heights[index] };
    cursor += heights[index] + gap;
    items.push(
      row.entry.field
        ? fieldItem(c, row.entry.field, box, { style: row.style, z: 11 })
        : blankItem(c, row.entry.blank, box, { style: row.style, z: 11 })
    );
  });
  return items;
}

/** The title: kicker above it (when present), headline, and tagline/subtitle (when present). */
function titleEntries(c, { includeTagline = true } = {}) {
  const room = Math.max(MIN_RECIPE_FONT * 2, Math.round(c.box.h * TITLE_LINE_SHARE));
  const entries = [];
  if (c?.words?.title_sub && String(c.words.title_sub).trim()) {
    entries.push(blankLine('title_sub', 'lead'));
  }
  entries.push(headlineLine(room));
  if (includeTagline && c?.words?.tagline && String(c.words.tagline).trim()) {
    entries.push(fieldLine('tagline', 'tagline', 'regular'));
  }
  return entries;
}

function titleHeight(c, width, options) {
  return groupHeight(c, titleEntries(c, options), width, 16);
}

function titleBlock(c, rect, options = {}) {
  return groupLines(c, titleEntries(c, options), rect, { innerGap: 16 });
}

/** The two lines beside the round mark, kept only when non-empty. */
function sloganEntries(c) {
  const list = [];
  if (c?.words?.slogan_1 && String(c.words.slogan_1).trim()) {
    list.push(blankLine('slogan_1', 'strong'));
  }
  if (c?.words?.slogan_2 && String(c.words.slogan_2).trim()) {
    list.push(blankLine('slogan_2', 'regular'));
  }
  return list;
}

function wordsEntries(c) {
  const list = sloganEntries(c);
  if (c?.words?.details && (Array.isArray(c.words.details) ? c.words.details.length > 0 : Boolean(c.words.details))) {
    list.push(fieldLine('details', 'details', 'regular'));
  }
  return list;
}

function wordsHeight(c, width, entries) {
  const list = (entries || wordsEntries(c)).filter((entry) => hasEntryText(c, entry));
  return groupHeight(c, list, width);
}

function wordsBlock(c, rect, entries) {
  const list = (entries || wordsEntries(c)).filter((entry) => hasEntryText(c, entry));
  return groupLines(c, list, rect);
}

/**
 * A drawn rule: the thin mark that separates two facts, or underlines a heading.
 */
function ruleItem(c, id, rect) {
  return shapeItem(c, id, rect, { fill: c.palette.accent, radius: 0, z: 3 });
}

/**
 * Date, time, venue as three separate equal cards.
 */
function factPlan(c, width, options) {
  const keys = ['date', 'time', 'venue'];
  const gap = 16;
  const cellWidth = Math.floor((width - (keys.length - 1) * gap) / keys.length);
  return { keys, columns: true, gap, inner: width, textWidth: cellWidth, height: 110 };
}

function factHeight(c, width, { keysOverride = null } = {}) {
  const keys = keysOverride || ['date', 'time', 'venue'];
  const activeKeys = keys.filter((k) => Boolean(String(c.words[k] || '').trim()));
  if (activeKeys.length === 0) return 0;
  const gap = 16;
  const padX = 8;
  const cellWidth = Math.max(MIN_TEXT_WIDTH, Math.floor((width - (activeKeys.length - 1) * gap) / activeKeys.length));
  const textWidth = cellWidth - padX * 2;
  let maxTextH = 0;
  for (const k of activeKeys) {
    const val = String(c.words[k] || '').trim();
    const style = textStyle(c, 'strong', { align: c.align || 'center' });
    const h = estimatedTextHeight({ w: textWidth, style, kind: 'field', field: k }, val);
    if (h > maxTextH) maxTextH = h;
  }
  return Math.max(110, maxTextH + 24);
}

function factBlock(c, rect, { plate = false, fillOverride = null, strokeOverride = null, align = null, keysOverride = null } = {}) {
  const keys = keysOverride || ['date', 'time', 'venue'];
  const activeKeys = keys.filter((k) => Boolean(String(c.words[k] || '').trim()));
  if (activeKeys.length === 0) return [];
  const gap = 16;
  const cellWidth = Math.floor((rect.w - (activeKeys.length - 1) * gap) / activeKeys.length);
  const items = [];

  const tokens = c.tokens || brandTokensOf(c.brand);
  const primary = tokens.primary || c.brand.primary;
  const dark = tokens.dark || c.brand.dark || '#0F172A';
  const fill = fillOverride || tint(primary, 0.94);
  const stroke = strokeOverride || tint(primary, 0.72);
  const cardAlign = align || c.align || 'center';

  if (plate) {
    items.push(
      shapeItem(c, 'fact-plate', rect, {
        fill,
        stroke,
        strokeWidth: 1,
        radius: 16,
        z: 2,
      })
    );
    const ruleH = Math.round(rect.h * PILL_DIVIDER_RATIO);
    const ruleY = rect.y + Math.round((rect.h - ruleH) / 2);
    for (let i = 0; i < activeKeys.length - 1; i += 1) {
      const ruleX = rect.x + (i + 1) * cellWidth + i * gap + Math.round((gap - 4) / 2);
      items.push(
        shapeItem(c, `rule-${i + 1}`, { x: ruleX, y: ruleY, w: 4, h: ruleH }, {
          fill: stroke,
          stroke: stroke,
          strokeWidth: 2,
          z: 3,
        })
      );
    }
  }

  activeKeys.forEach((key, index) => {
    const cardX = rect.x + index * (cellWidth + gap);
    const cardRect = { x: cardX, y: rect.y, w: cellWidth, h: rect.h };

    if (!plate) {
      items.push(
        shapeItem(c, `card-${key}`, cardRect, {
          fill,
          stroke,
          strokeWidth: 1,
          radius: 12,
          z: 2,
        })
      );
    }

    const padX = 8;
    const padY = 8;
    const textRect = {
      x: cardX + padX,
      y: rect.y + padY,
      w: cellWidth - padX * 2,
      h: rect.h - padY * 2,
    };

    const textColor = pickReadableColor(
      [primary ? shade(primary, 0.45) : '#0f172a', dark, c.brand.ink, c.brand.body, '#111827', '#000000', '#ffffff'],
      fill,
      4.5
    );

    const style = textStyle(c, 'strong', {
      align: cardAlign,
      color: textColor,
    });

    items.push(fieldItem(c, key, textRect, { style, z: 11 }));
  });

  return items;
}

function factRowsHeight(c, width, { keysOverride = null } = {}) {
  const keys = keysOverride || ['date', 'time', 'venue'];
  const gap = 12;
  const padX = 12;
  const textWidth = Math.max(MIN_TEXT_WIDTH, width - padX * 2);
  let totalH = 0;
  const activeKeys = keys.filter((k) => Boolean(String(c.words[k] || '').trim()));
  if (activeKeys.length === 0) return 0;
  for (const k of activeKeys) {
    const val = String(c.words[k] || '').trim();
    const face = ROLE_LOOK.strong(c);
    const size = fitWordSize(val, textWidth, c.sizes.strong, face, 20);
    const style = { ...textStyle(c, 'strong', { align: 'left' }), size };
    const h = Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: textWidth, style, kind: 'field', field: k }, val));
    totalH += h + 16;
  }
  return totalH + (activeKeys.length > 1 ? gap * (activeKeys.length - 1) : 0);
}

function factRowsBlock(c, rect, { fillOverride = null, strokeOverride = null, keysOverride = null } = {}) {
  const keys = keysOverride || ['date', 'time', 'venue'];
  const gap = 12;
  const padX = 12;
  const padY = 8;
  const textWidth = Math.max(MIN_TEXT_WIDTH, rect.w - padX * 2);
  const items = [];
  const tokens = c.tokens || brandTokensOf(c.brand);
  const primary = tokens.primary || c.brand.primary;
  const dark = tokens.dark || c.brand.dark || '#0F172A';
  const fill = fillOverride || tint(primary, 0.94);
  const stroke = strokeOverride || tint(primary, 0.72);

  const activeKeys = keys.filter((k) => Boolean(String(c.words[k] || '').trim()));
  if (activeKeys.length === 0) return [];

  const heights = activeKeys.map((k) => {
    const val = String(c.words[k] || '').trim();
    const face = ROLE_LOOK.strong(c);
    const size = fitWordSize(val, textWidth, c.sizes.strong, face, 20);
    const style = { ...textStyle(c, 'strong', { align: 'left' }), size };
    const textH = Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: textWidth, style, kind: 'field', field: k }, val));
    return textH + padY * 2;
  });

  let cursor = rect.y;
  activeKeys.forEach((key, index) => {
    const cardH = heights[index];
    const cardRect = { x: rect.x, y: cursor, w: rect.w, h: cardH };
    items.push(
      shapeItem(c, `card-${key}`, cardRect, {
        fill,
        stroke,
        strokeWidth: 1,
        radius: 12,
        z: 2,
      })
    );

    const textRect = {
      x: rect.x + padX,
      y: cursor + padY,
      w: textWidth,
      h: cardH - padY * 2,
    };

    const textColor = pickReadableColor(
      ['#ffffff', '#000000', dark, primary, c.brand.ink],
      fill,
      4.5
    );

    const val = String(c.words[key] || '').trim();
    const face = ROLE_LOOK.strong(c);
    const size = fitWordSize(val, textWidth, c.sizes.strong, face, 20);
    const style = {
      ...textStyle(c, 'strong', {
        align: 'left',
        color: textColor,
      }),
      size,
    };

    items.push(fieldItem(c, key, textRect, { style, z: 11 }));
    cursor += cardH + gap;
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

function ctaEntries() {
  return [blankLine('cta_line', 'strong')];
}

function buttonStyle(c) {
  return textStyle(c, 'button', { fill: c.palette.primary, align: 'center' });
}

function buttonWords(c) {
  const raw = String(c.words.cta_button || c.words.cta_line || '').trim();
  if (!raw || /^(join\s+us|come\s+celebrate|find\s+out\s+more)$/i.test(raw)) {
    return 'Registration desk open from 7 AM';
  }
  return raw;
}

function ctaHeight(c, width) {
  const hasLine = Boolean(c.words.cta_line && String(c.words.cta_line).trim() && !isDropped(c, 'cta_line'));
  const lineH = hasLine
    ? Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style: textStyle(c, 'strong') }, c.words.cta_line)) + 16
    : 0;
  return lineH + 54;
}

function ctaBlock(c, rect, { centre = false, fillOverride = null } = {}) {
  const items = [];
  let cursor = rect.y;
  const align = centre || c.align === 'center' ? 'center' : 'left';

  const hasLine = Boolean(c.words.cta_line && String(c.words.cta_line).trim() && !isDropped(c, 'cta_line'));
  if (hasLine) {
    const lineStyle = textStyle(c, 'strong');
    const lineH = Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: rect.w, style: lineStyle }, c.words.cta_line));
    const lineBox = { x: rect.x, y: cursor, w: rect.w, h: lineH };
    items.push(
      blankItem(c, 'cta_line', lineBox, {
        style: { ...lineStyle, align },
        z: 11,
      })
    );
    cursor += lineH + 16;
  }

  const barH = 54;
  const barBox = { x: rect.x, y: cursor, w: rect.w, h: barH };
  const plateFill = fillOverride || c.tokens?.primary || c.palette.primary || c.palette.accent;

  // Full-width solid label bar
  items.push(
    plateItem(c, 'button-plate', barBox, {
      fill: plateFill,
      radius: 12,
      z: 5,
    })
  );

  const textColor = pickReadableColor(['#ffffff', '#000000', c.tokens?.dark || '#0f172a'], plateFill, 4.5);

  const barStyle = {
    ...textStyle(c, 'button'),
    align,
    color: textColor,
  };
  items.push(blankItem(c, 'cta_button', barBox, { style: barStyle, z: 12 }));

  return items;
}

/** The round mark a design puts its icon or picture in. */
function artBlock(c, rect, { centre = false } = {}) {
  if (c.options.artwork === 'none' || isDropped(c, 'artwork')) return [];
  const items = [];
  const square = centre ? squareIn(rect) : boxOf(rect);
  const photo = libraryPhoto(c.slots.imageUrl);
  const side = Math.max(ELEMENT_LIMITS.minWidth, Math.round(Math.min(square.w, square.h) * 0.8));
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
        circleItem(c, 'art-ring', grow(square, 4), { stroke: c.palette.accent, strokeWidth: 0, fill: '', z: 5 })
      );
    }
    return items;
  }

  if (c.options.artwork === 'medallion') {
    items.push(circleItem(c, 'art-plate', square, { fill: tint(c.palette.accent, 0.82), z: 3 }));
    items.push(
      iconItem(c, 'art-icon', centered, {
        name: c.icon,
        color: shade(c.palette.accent, 0.12),
        strokeWidth: 3,
        z: 7,
      })
    );
    return items;
  }

  if (c.options.artwork === 'emblem') {
    items.push(iconItem(c, 'art-icon', centered, { name: c.icon, color: c.palette.accent, strokeWidth: 2, z: 7 }));
    return items;
  }

  /* stacked: two marks under each other with a thin rule between them. */
  const rows = rowsIn(square, [1, 0.18, 1], Math.round(square.h * 0.04));
  items.push(iconItem(c, 'art-icon', rows[0], { name: c.icon, color: c.palette.accent, z: 7 }));
  items.push(ruleItem(c, 'art-rule', rows[1]));
  items.push(iconItem(c, 'art-icon-2', rows[2], { name: 'sparkles', color: shade(c.palette.accent, 0.2), z: 7 }));
  return items;
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
      circleItem(
        c,
        `deco-dot-${index + 1}`,
        { x: rect.x + Math.round((rect.w - size) * (index / 2)), y: rect.y + rect.h - size, w: size, h: size },
        { fill, opacity, z: 0 }
      )
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
    .map((lineText) => wordsOf(lineText, 90))
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

function fitContextSizes(c) {
  const boxW = c.box.w;
  const faceHead = ROLE_LOOK.heading(c);
  const fitHead = fitTextSize({
    text: c.words.headline,
    width: boxW - 40,
    size: c.sizes.heading,
    min: MIN_RECIPE_FONT,
    face: faceHead,
  });
  c.sizes.heading = fitWordSize(
    c.words.headline,
    boxW - 40,
    fitHead,
    faceHead,
    MIN_RECIPE_FONT
  );

  const strongWords = [
    c.words.date,
    c.words.time,
    c.words.venue,
    c.words.slogan_1,
    c.words.cta_line,
  ].filter(Boolean).join(' ');
  const minCardWidth = Math.max(MIN_TEXT_WIDTH, Math.floor((boxW - 32) / 3) - 16);
  const faceStrong = ROLE_LOOK.strong(c);
  c.sizes.strong = fitWordSize(
    strongWords,
    minCardWidth,
    c.sizes.strong,
    faceStrong,
    MIN_RECIPE_FONT
  );

  const regWords = [
    c.words.tagline,
    c.words.slogan_2,
    ...(Array.isArray(c.words.details) ? c.words.details : []),
  ].filter(Boolean).join(' ');
  const faceReg = ROLE_LOOK.regular(c);
  c.sizes.regular = fitWordSize(
    regWords,
    Math.max(MIN_TEXT_WIDTH, Math.floor(boxW * 0.45)),
    c.sizes.regular,
    faceReg,
    MIN_RECIPE_FONT
  );
}

/**
 * Everything a block needs, worked out once per design.
 *
 * The `scale` and `dropped` of a plan are what the layout engine moves while it looks for a set of
 * sizes that fits the space between the two brand bands.
 */
function contextOf(area, brandKit, slots, options, design = null) {
  const brand = brandOf(brandKit);
  const tokens = brandTokensOf(brandKit);
  const box = frameOf(area);
  const unit = spacingUnit(area.w);
  const c = {
    area,
    box,
    brand,
    tokens,
    slots,
    options,
    type: typeOf(options.typeStyle),
    palette: paletteOf(brand, options.palette),
    words: slots,
    facts: FACT_FIELDS.filter((key) => Boolean(slots[key])),
    align: options.align || (options.variant % 2 === 1 ? 'center' : 'left'),
    surface: posterSurface(brandKit),
    inks: inkOptions(brand),
    unit,
    gap: Math.max(8, Math.min(unit, Math.round(box.h / 16))),
    inner: Math.max(4, Math.round(unit * 0.6)),
    scale: 1,
    dropped: new Set(),
    /** A word in the accent colour is only ever used where it also reads. */
    accentInk: readableColorOn(posterSurface(brandKit), inkOptions(brand)),
    /** A poster's own part is only placed when the content has words for it, so no hole shows. */
    hasWords: (key) => (key === 'details' ? slots.details.length > 0 : Boolean(slots[key])),
  };
  c.sizes = sizesOf(c.type, area.w, box.h, 1);
  fitContextSizes(c);
  c.icon =
    slots.icon ||
    iconForWords(
      [slots.headline, slots.tagline, slots.venue, ...(Array.isArray(slots?.details) ? slots.details : [])].filter(Boolean).join(' '),
      design?.suits?.[0] || 'general'
    );
  return c;
}

/** The same design at another size, or with another line given up. */
function planOf(c, scale, dropped) {
  const next = { ...c, scale, dropped: dropped || c.dropped };
  next.sizes = sizesOf(c.type, c.area.w, c.box.h, scale);
  fitContextSizes(next);
  next.accentInk = readableColorOn(c.surface, inkOptions(c.brand));
  return next;
}

/* ------------------------------------------------------------------------- *
 * The vertical rhythm: blocks measured by their own words
 * ------------------------------------------------------------------------- */

function present(c, specs) {
  return specs.filter((spec) => !isDropped(c, spec.key) && (!spec.when || spec.when(c)));
}

function minGapBetweenSpecs(a, b) {
  const kA = a?.key;
  const kB = b?.key;
  if ((kA === 'photo' || kA === 'hero-photo') && (kB === 'title' || kB === 'kicker' || kB === 'band' || kB === 'badge' || kB === 'title_sub')) return 32;
  if ((kA === 'kicker' || kA === 'badge' || kA === 'overline' || kA === 'title_sub') && kB === 'title') return 16;
  if (kA === 'title' && (kB === 'subtitle' || kB === 'tagline' || kB === 'rule')) return 16;
  if (kA === 'rule' && (kB === 'subtitle' || kB === 'tagline')) return 16;
  if ((kA === 'tagline' || kB === 'tagline') && (kB === 'slogans' || kA === 'slogans')) return 16;
  if ((kA === 'title' || kA === 'subtitle' || kA === 'tagline' || kA === 'rule' || kA === 'band' || kA === 'slogans') && (kB === 'pill' || kB === 'facts' || kB === 'fact' || kB === 'cards')) return 48;
  if ((kA === 'pill' || kA === 'facts' || kA === 'fact' || kA === 'cards') && (kB === 'words' || kB === 'details' || kB === 'cta' || kB === 'schedule' || kB === 'button')) return 40;
  if ((kA === 'words' || kA === 'details' || kA === 'schedule' || kA === 'slogans') && (kB === 'cta' || kB === 'button')) return 40;
  if (kA === 'artwork' && (kB === 'pill' || kB === 'facts' || kB === 'cards')) return 48;
  if (kA === 'title' && kB === 'artwork') return 32;
  return 32;
}

/**
 * The heights of one design's blocks in the space it has.
 *
 * Minimum gaps: 32px photo to kicker, 16px kicker to title to subtitle,
 * 48px title group to info row, 40px info row to bullets to CTA.
 * Leftover height is distributed evenly so no more than 10% stays empty.
 */
function layoutOf(c, box, specs) {
  const live = present(c, specs);
  if (live.length === 0) return { live, heights: [], gaps: [], spare: 0, fits: true };
  const mins = live.map((spec) => (spec.min ? Math.max(0, spec.min(c, box.w)) : 0));
  const heights = live.map((spec, index) =>
    Math.max(
      mins[index],
      spec.thin ? Math.max(1, spec.height(c, box.w)) : Math.max(ELEMENT_LIMITS.minHeight, spec.height(c, box.w))
    )
  );

  const gaps = [];
  for (let i = 0; i < live.length - 1; i += 1) {
    gaps.push(minGapBetweenSpecs(live[i], live[i + 1]));
  }

  let total = heights.reduce((acc, height) => acc + height, 0) + gaps.reduce((acc, g) => acc + g, 0);

  let shrinkIterations = 0;
  const shrinkStart = Date.now();
  while (total > box.h && shrinkIterations < 200 && Date.now() - shrinkStart <= 1500) {
    shrinkIterations += 1;
    let changed = false;
    for (let i = 0; i < gaps.length; i += 1) {
      const minG = Math.max(16, Math.round(minGapBetweenSpecs(live[i], live[i + 1]) * 0.7));
      if (gaps[i] > minG) {
        gaps[i] = Math.max(minG, gaps[i] - 2);
        changed = true;
      }
    }
    if (!changed) break;
    total = heights.reduce((acc, height) => acc + height, 0) + gaps.reduce((acc, g) => acc + g, 0);
  }

  if (total > box.h) {
    live.forEach((spec, index) => {
      if (!spec.flex || heights[index] <= mins[index]) return;
      const cut = Math.min(heights[index] - mins[index], total - box.h);
      heights[index] -= cut;
      total -= cut;
    });
  }

  let leftover = Math.max(0, box.h - total);
  const flexes = live.map((spec, index) => (spec.flex ? index : -1)).filter((index) => index >= 0);
  if (leftover > 0 && flexes.length > 0) {
    const share = Math.floor(leftover / flexes.length);
    flexes.forEach((index) => {
      heights[index] += share;
      leftover -= share;
    });
  }
  if (leftover > 0 && gaps.length > 0) {
    for (let i = 0; i < gaps.length; i += 1) {
      const maxAdd = Math.max(0, 48 - gaps[i]);
      const add = Math.min(Math.floor(leftover / (gaps.length - i)), maxAdd);
      gaps[i] += add;
      leftover -= add;
    }
  }

  const finalUsed = heights.reduce((acc, height) => acc + height, 0) + gaps.reduce((acc, g) => acc + g, 0);
  const spare = Math.max(0, box.h - finalUsed);

  return { live, heights, gaps, spare, fits: finalUsed <= box.h };
}

/** True while a block that asks for its columns on one line still gets them at this size. */
function holdsColumns(c, spec, width) {
  if (!spec.columns) return true;
  const plan = factPlan(c, width, spec.columns);
  return !plan || plan.columns || plan.keys.length < 2;
}

/**
 * Lay the blocks out, giving up words in order until they fit.
 */
function stack(c, box, specs, gapOverride = 0) {
  let iter = 0;
  const startTime = Date.now();
  let bestPlan = null;
  let bestLaid = null;
  let minOverflow = Infinity;

  const buildItems = (plan, laid) => {
    const items = [];
    let cursor = box.y + Math.max(0, Math.round(laid.spare / 2));
    laid.live.forEach((spec, index) => {
      const rect = { x: box.x, y: cursor, w: box.w, h: laid.heights[index] };
      const made = spec.make(plan, rect);
      items.push(...(Array.isArray(made) ? made : [made]));
      cursor += laid.heights[index] + (laid.gaps[index] || 0);
    });
    return items;
  };

  for (let dropCount = 0; dropCount <= DROP_ORDER.length; dropCount += 1) {
    if (iter >= 200 || Date.now() - startTime > 1500) break;
    const dropped = new Set(DROP_ORDER.slice(0, dropCount));
    for (const scale of SCALES) {
      iter += 1;
      const plan = planOf(c, scale, dropped);
      const laid = layoutOf(plan, box, specs);
      const keepsShape = scale <= 1 || laid.live.every((spec) => holdsColumns(plan, spec, box.w));

      const totalH = laid.heights.reduce((acc, height) => acc + height, 0) + laid.gaps.reduce((acc, g) => acc + g, 0);
      const overflow = Math.max(0, totalH - box.h);
      if (overflow < minOverflow || !bestPlan) {
        minOverflow = overflow;
        bestPlan = plan;
        bestLaid = laid;
      }

      if ((laid.fits && keepsShape) || (dropCount === DROP_ORDER.length && scale === SCALES[SCALES.length - 1])) {
        return buildItems(plan, laid);
      }

      if (iter >= 200 || Date.now() - startTime > 1500) {
        return buildItems(bestPlan || plan, bestLaid || laid);
      }
    }
  }

  if (bestPlan && bestLaid) {
    return buildItems(bestPlan, bestLaid);
  }
  return [];
}

function slogansSpec(c, { align = 'left' } = {}) {
  return {
    key: 'slogans',
    when: (ctx) => {
      const s1 = !ctx.dropped.has('slogan_1') && String(ctx.words.slogan_1 || '').trim();
      const s2 = !ctx.dropped.has('slogan_2') && String(ctx.words.slogan_2 || '').trim();
      return Boolean(s1 || s2);
    },
    height: (ctx, width) => {
      let h = 0;
      const s1 = !ctx.dropped.has('slogan_1') && String(ctx.words.slogan_1 || '').trim();
      const s2 = !ctx.dropped.has('slogan_2') && String(ctx.words.slogan_2 || '').trim();
      if (s1) {
        h += Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style: textStyle(ctx, 'strong') }, s1));
      }
      if (s2) {
        if (h > 0) h += 8;
        h += Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style: textStyle(ctx, 'regular') }, s2));
      }
      return h;
    },
    make: (ctx, rect) => {
      const items = [];
      let cursor = rect.y;
      const s1 = !ctx.dropped.has('slogan_1') && String(ctx.words.slogan_1 || '').trim();
      const s2 = !ctx.dropped.has('slogan_2') && String(ctx.words.slogan_2 || '').trim();
      if (s1) {
        const style1 = { ...textStyle(ctx, 'strong'), align };
        const h1 = Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: rect.w, style: style1 }, s1));
        items.push(blankItem(ctx, 'slogan_1', { x: rect.x, y: cursor, w: rect.w, h: h1 }, { style: style1, z: 11 }));
        cursor += h1 + 8;
      }
      if (s2) {
        const style2 = { ...textStyle(ctx, 'regular'), align };
        const h2 = Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: rect.w, style: style2 }, s2));
        items.push(blankItem(ctx, 'slogan_2', { x: rect.x, y: cursor, w: rect.w, h: h2 }, { style: style2, z: 11 }));
      }
      return items;
    },
  };
}

/* ------------------------------------------------------------------------- *
 * The 8 layout archetype recipes
 * ------------------------------------------------------------------------- */

/**
 * 1. Bold Type Archetype (Notice / General)
 * Giant headline, accent rule, tagline, details, 3 equal info cards, left-aligned.
 */
export function boldTypeRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, { ...options, align: 'left' }, design);
  const tokens = c.tokens;
  const isReordered = c.options.variant === 1;
  const isDarkEmphasis = c.options.variant === 2;

  const cardFill = isDarkEmphasis ? tokens.dark : tint(tokens.primary, 0.94);
  const cardStroke = isDarkEmphasis ? tokens.accent : tint(tokens.primary, 0.72);

  const artworkSpec = {
    key: 'artwork',
    when: (ctx) => ctx.options.artwork === 'medallion',
    height: () => 70,
    make: (ctx, rect) => [
      iconItem(ctx, 'bold-icon', {
        x: rect.x,
        y: rect.y,
        w: 70,
        h: 70,
      }, { name: ctx.icon || 'trophy', color: tokens.accent, strokeWidth: 2, z: 8 }),
    ],
  };

  const badgeSpec = {
    key: 'badge',
    when: (ctx) => Boolean(ctx.words.title_sub || ctx.words.kicker),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'lead');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.title_sub || ctx.words.kicker));
    },
    make: (ctx, rect) => [
      blankItem(ctx, 'title_sub', rect, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'left',
          color: tokens.accent,
        },
        z: 11,
      }),
    ],
  };

  const titleSpec = {
    key: 'title',
    height: (ctx, width) => {
      const style = textStyle(ctx, 'heading');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.headline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'headline', rect, {
        style: {
          ...textStyle(ctx, 'heading'),
          align: 'left',
          color: isDarkEmphasis ? '#ffffff' : tokens.primary,
        },
        z: 11,
      }),
    ],
  };

  const ruleSpec = {
    key: 'rule',
    thin: true,
    height: () => 8,
    make: (ctx, rect) => [
      shapeItem(ctx, 'bold-rule', { x: rect.x, y: rect.y, w: Math.min(rect.w, 260), h: 8 }, {
        fill: tokens.accent,
        stroke: tokens.accent,
        strokeWidth: 4,
        z: 3,
      }),
    ],
  };

  const taglineSpec = {
    key: 'tagline',
    when: (ctx) => Boolean(ctx.words.tagline && String(ctx.words.tagline).trim()),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.tagline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'tagline', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'left',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const slogans = slogansSpec(c, { align: 'left' });

  const detailsSpec = {
    key: 'details',
    when: (ctx) => Array.isArray(ctx.words.details) && ctx.words.details.length > 0,
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.details));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'details', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'left',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const factsSpec = {
    key: 'facts',
    height: (ctx, width) => factHeight(ctx, width),
    make: (ctx, rect) => factBlock(ctx, rect, { fillOverride: cardFill, strokeOverride: cardStroke, align: 'left' }),
  };

  const ctaSpec = {
    key: 'cta',
    height: (ctx, width) => ctaHeight(ctx, width),
    make: (ctx, rect) => ctaBlock(ctx, rect, { centre: false, fillOverride: tokens.primary }),
  };

  const specs = isReordered
    ? [artworkSpec, badgeSpec, titleSpec, ruleSpec, taglineSpec, slogans, detailsSpec, ctaSpec, factsSpec]
    : [artworkSpec, badgeSpec, titleSpec, ruleSpec, taglineSpec, slogans, detailsSpec, factsSpec, ctaSpec];

  return collect(c, stack(c, c.box, specs));
}

/**
 * 2. Photo Hero Archetype (Health / Awareness / Festival)
 * Large photo hero, headline on solid band, tagline, details, 3 equal info cards, center-aligned.
 */
export function photoHeroRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, { ...options, align: 'center' }, design);
  const tokens = c.tokens;
  const isPhotoBelow = c.options.variant === 1;
  const isDarkEmphasis = c.options.variant === 2;
  const isTitleScale = c.options.variant === 3;

  const cardFill = isDarkEmphasis ? tokens.dark : tint(tokens.primary, 0.94);
  const cardStroke = isDarkEmphasis ? tokens.accent : tint(tokens.primary, 0.72);
  const bandFill = isDarkEmphasis ? tokens.dark : tokens.primary;
  const titleColor = pickReadableColor(['#ffffff', '#000000', tokens.accent], bandFill, 4.5);

  const photoH = isTitleScale ? 240 : 280;

  const photoSpec = {
    key: 'photo',
    flex: true,
    min: () => 140,
    height: () => photoH,
    make: (ctx, rect) => [
      fieldItem(ctx, 'photo', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          radius: 16,
          fit: 'cover',
          fill: tint(tokens.primary, 0.92),
          color: tokens.primary,
        },
        z: 4,
      }),
    ],
  };

  const titleBandSpec = {
    key: 'title',
    height: (ctx, width) => {
      const style = textStyle(ctx, 'heading');
      const textH = estimatedTextHeight({ w: width - 40, style }, ctx.words.headline);
      return Math.max(90, textH + 32);
    },
    make: (ctx, rect) => {
      const plate = shapeItem(ctx, 'hero-band-plate', rect, {
        fill: bandFill,
        radius: 12,
        z: 2,
      });
      const title = fieldItem(ctx, 'headline', { x: rect.x + 20, y: rect.y + 16, w: rect.w - 40, h: rect.h - 32 }, {
        style: {
          ...textStyle(ctx, 'heading'),
          align: 'center',
          color: titleColor,
        },
        z: 11,
      });
      return [plate, title];
    },
  };

  const kickerSpec = {
    key: 'kicker',
    when: (ctx) => Boolean(ctx.words.title_sub || ctx.words.kicker),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'lead');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.title_sub || ctx.words.kicker));
    },
    make: (ctx, rect) => [
      blankItem(ctx, 'title_sub', rect, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'center',
          color: tokens.accent,
        },
        z: 11,
      }),
    ],
  };

  const taglineSpec = {
    key: 'tagline',
    when: (ctx) => Boolean(ctx.words.tagline && String(ctx.words.tagline).trim()),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.tagline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'tagline', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'center',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const slogans = slogansSpec(c, { align: 'center' });

  const detailsSpec = {
    key: 'details',
    when: (ctx) => Array.isArray(ctx.words.details) && ctx.words.details.length > 0,
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.details));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'details', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'center',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const factsSpec = {
    key: 'facts',
    height: (ctx, width) => factHeight(ctx, width),
    make: (ctx, rect) => factBlock(ctx, rect, { fillOverride: cardFill, strokeOverride: cardStroke, align: 'center' }),
  };

  const ctaSpec = {
    key: 'cta',
    height: (ctx, width) => ctaHeight(ctx, width),
    make: (ctx, rect) => ctaBlock(ctx, rect, { centre: true, fillOverride: bandFill }),
  };

  const specs = isPhotoBelow
    ? [kickerSpec, titleBandSpec, taglineSpec, photoSpec, slogans, detailsSpec, factsSpec, ctaSpec]
    : [photoSpec, kickerSpec, titleBandSpec, taglineSpec, slogans, detailsSpec, factsSpec, ctaSpec];

  return collect(c, stack(c, c.box, specs));
}

/**
 * 3. Date Block Archetype (Sports / Festival / Meeting)
 * Prominent side date block with big day & month numbers, content column, left-aligned.
 */
export function dateBlockRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, { ...options, align: 'left' }, design);
  const tokens = c.tokens;
  const isReordered = c.options.variant === 1;
  const isDarkEmphasis = c.options.variant === 2;

  const panelFill = isDarkEmphasis ? tokens.dark : tokens.primary;
  const panelText = pickReadableColor(['#ffffff', '#000000', tokens.accent], panelFill, 4.5);
  const cardFill = isDarkEmphasis ? tokens.dark : tint(tokens.primary, 0.94);
  const cardStroke = isDarkEmphasis ? tokens.accent : tint(tokens.primary, 0.72);

  const dateBannerSpec = {
    key: 'banner',
    height: (ctx, width) => {
      const textW = width - 96;
      const textH = Math.max(48, estimatedTextHeight({ w: textW, style: textStyle(ctx, 'strong') }, ctx.words.date || 'Event Date'));
      return textH + 32;
    },
    make: (ctx, rect) => {
      const plate = shapeItem(ctx, 'date-panel-bg', rect, {
        fill: panelFill,
        stroke: tokens.accent,
        strokeWidth: 2,
        radius: 16,
        z: 2,
      });
      const icon = iconItem(ctx, 'date-panel-icon', {
        x: rect.x + 20,
        y: rect.y + Math.round((rect.h - 50) / 2),
        w: 50,
        h: 50,
      }, { name: ctx.icon || 'trophy', color: tokens.accent, strokeWidth: 2, z: 8 });
      const textW = rect.w - 96;
      const textH = Math.max(ELEMENT_LIMITS.minHeight, rect.h - 32);
      const dateText = fieldItem(ctx, 'date', {
        x: rect.x + 80,
        y: rect.y + 16,
        w: textW,
        h: textH,
      }, {
        style: {
          ...textStyle(ctx, 'strong'),
          align: 'left',
          color: panelText,
        },
        z: 11,
      });
      return [plate, icon, dateText];
    },
  };

  const kickerSpec = {
    key: 'kicker',
    when: (ctx) => Boolean(ctx.words.title_sub || ctx.words.kicker),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'lead');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.title_sub || ctx.words.kicker));
    },
    make: (ctx, rect) => [
      blankItem(ctx, 'title_sub', rect, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'left',
          color: tokens.accent,
        },
        z: 11,
      }),
    ],
  };

  const titleSpec = {
    key: 'title',
    height: (ctx, width) => {
      const style = textStyle(ctx, 'heading');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.headline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'headline', rect, {
        style: {
          ...textStyle(ctx, 'heading'),
          align: 'left',
          color: isDarkEmphasis ? '#ffffff' : tokens.primary,
        },
        z: 11,
      }),
    ],
  };

  const taglineSpec = {
    key: 'tagline',
    when: (ctx) => Boolean(ctx.words.tagline && String(ctx.words.tagline).trim()),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.tagline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'tagline', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'left',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const ruleSpec = {
    key: 'rule',
    thin: true,
    height: () => 4,
    make: (ctx, rect) => [
      shapeItem(ctx, 'date-main-rule', { x: rect.x, y: rect.y, w: Math.min(rect.w, 240), h: 4 }, {
        fill: tokens.accent,
        stroke: tokens.accent,
        strokeWidth: 2,
        z: 3,
      }),
    ],
  };

  const slogans = slogansSpec(c, { align: 'left' });

  const detailsSpec = {
    key: 'details',
    when: (ctx) => Array.isArray(ctx.words.details) && ctx.words.details.length > 0,
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.details));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'details', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'left',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const factsSpec = {
    key: 'facts',
    when: (ctx) => ['time', 'venue'].some((k) => Boolean(String(ctx.words[k] || '').trim())),
    height: (ctx, width) => factHeight(ctx, width, { keysOverride: ['time', 'venue'] }),
    make: (ctx, rect) => factBlock(ctx, rect, { fillOverride: cardFill, strokeOverride: cardStroke, align: 'left', keysOverride: ['time', 'venue'] }),
  };

  const ctaSpec = {
    key: 'cta',
    height: (ctx, width) => ctaHeight(ctx, width),
    make: (ctx, rect) => ctaBlock(ctx, rect, { centre: false, fillOverride: panelFill }),
  };

  const specs = isReordered
    ? [kickerSpec, titleSpec, taglineSpec, ruleSpec, dateBannerSpec, slogans, detailsSpec, factsSpec, ctaSpec]
    : [dateBannerSpec, kickerSpec, titleSpec, taglineSpec, ruleSpec, slogans, detailsSpec, factsSpec, ctaSpec];

  return collect(c, stack(c, c.box, specs));
}

/**
 * 4. Ticket Archetype (Festival / Celebration / Event)
 * Framed ticket with side notches, centered icon, title, details, divider line, info cards, center-aligned.
 */
export function ticketRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, { ...options, align: 'center' }, design);
  const tokens = c.tokens;
  const isStubTop = c.options.variant === 1;
  const isDarkEmphasis = c.options.variant === 2;

  const ticketFill = isDarkEmphasis ? tokens.dark : tint(tokens.primary, 0.96);
  const ticketBorder = tokens.accent;
  const cardFill = isDarkEmphasis ? shade(tokens.dark, 0.2) : tint(tokens.primary, 0.92);
  const cardStroke = tokens.accent;

  const outerPad = 12;
  const ticketRect = {
    x: c.box.x + outerPad,
    y: c.box.y + outerPad,
    w: c.box.w - outerPad * 2,
    h: c.box.h - outerPad * 2,
  };
  const innerPad = 24;
  const innerBox = {
    x: ticketRect.x + innerPad,
    y: ticketRect.y + innerPad,
    w: ticketRect.w - innerPad * 2,
    h: ticketRect.h - innerPad * 2,
  };

  const frameItems = [
    shapeItem(c, 'ticket-outer', ticketRect, {
      fill: ticketFill,
      stroke: ticketBorder,
      strokeWidth: 3,
      radius: 24,
      z: 1,
    }),
  ];

  const artworkSpec = {
    key: 'artwork',
    height: () => 70,
    make: (ctx, rect) => [
      iconItem(ctx, 'ticket-icon', {
        x: rect.x + Math.round((rect.w - 70) / 2),
        y: rect.y,
        w: 70,
        h: 70,
      }, { name: ctx.icon || 'sparkles', color: tokens.accent, strokeWidth: 2, z: 8 }),
    ],
  };

  const badgeSpec = {
    key: 'badge',
    when: (ctx) => Boolean(ctx.words.title_sub || ctx.words.kicker),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'lead');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.title_sub || ctx.words.kicker));
    },
    make: (ctx, rect) => [
      blankItem(ctx, 'title_sub', rect, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'center',
          color: tokens.accent,
        },
        z: 11,
      }),
    ],
  };

  const titleSpec = {
    key: 'title',
    height: (ctx, width) => {
      const style = textStyle(ctx, 'heading');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.headline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'headline', rect, {
        style: {
          ...textStyle(ctx, 'heading'),
          align: 'center',
          color: isDarkEmphasis ? '#ffffff' : tokens.primary,
        },
        z: 11,
      }),
    ],
  };

  const taglineSpec = {
    key: 'tagline',
    when: (ctx) => Boolean(ctx.words.tagline && String(ctx.words.tagline).trim()),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.tagline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'tagline', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'center',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const slogans = slogansSpec(c, { align: 'center' });

  const detailsSpec = {
    key: 'details',
    when: (ctx) => Array.isArray(ctx.words.details) && ctx.words.details.length > 0,
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.details));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'details', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'center',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const ruleSpec = {
    key: 'rule',
    thin: true,
    height: () => 4,
    make: (ctx, rect) => [
      shapeItem(ctx, 'ticket-divider', { x: rect.x, y: rect.y, w: rect.w, h: 4 }, {
        fill: tokens.accent,
        stroke: tokens.accent,
        strokeWidth: 3,
        z: 3,
      }),
    ],
  };

  const factsSpec = {
    key: 'facts',
    height: (ctx, width) => factHeight(ctx, width),
    make: (ctx, rect) => factBlock(ctx, rect, { plate: true, fillOverride: cardFill, strokeOverride: cardStroke, align: 'center' }),
  };

  const ctaSpec = {
    key: 'cta',
    height: (ctx, width) => ctaHeight(ctx, width),
    make: (ctx, rect) => ctaBlock(ctx, rect, { centre: true, fillOverride: tokens.primary }),
  };

  const ordered = isStubTop
    ? [factsSpec, ruleSpec, artworkSpec, badgeSpec, titleSpec, taglineSpec, slogans, detailsSpec, ctaSpec]
    : [artworkSpec, badgeSpec, titleSpec, taglineSpec, ruleSpec, slogans, detailsSpec, factsSpec, ctaSpec];

  const innerItems = stack(c, innerBox, ordered);
  return collect(c, [...frameItems, ...innerItems]);
}

/**
 * 5. Centered Award Archetype (Celebration / Achievement / Gala)
 * Elegant double frame, circular medal badge, overline, title, rule, tagline, details, center-aligned.
 */
export function centeredAwardRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, { ...options, align: 'center' }, design);
  const tokens = c.tokens;
  const isBadgeBelow = c.options.variant === 1;
  const isDarkEmphasis = c.options.variant === 2;

  const plateFill = isDarkEmphasis ? tokens.dark : tint(tokens.primary, 0.97);
  const borderStroke = tokens.accent;
  const cardFill = isDarkEmphasis ? shade(tokens.dark, 0.2) : tint(tokens.primary, 0.94);
  const cardStroke = tokens.accent;

  const outerPad = 10;
  const outerFrame = {
    x: c.box.x + outerPad,
    y: c.box.y + outerPad,
    w: c.box.w - outerPad * 2,
    h: c.box.h - outerPad * 2,
  };
  const innerPad = 20;
  const innerBox = {
    x: outerFrame.x + innerPad,
    y: outerFrame.y + innerPad,
    w: outerFrame.w - innerPad * 2,
    h: outerFrame.h - innerPad * 2,
  };

  const frames = [
    shapeItem(c, 'award-frame-outer', outerFrame, {
      fill: plateFill,
      stroke: borderStroke,
      strokeWidth: 3,
      radius: 6,
      z: 1,
    }),
    shapeItem(c, 'award-frame-inner', {
      x: outerFrame.x + 12,
      y: outerFrame.y + 12,
      w: outerFrame.w - 24,
      h: outerFrame.h - 24,
    }, {
      fill: '',
      stroke: tint(borderStroke, 0.4),
      strokeWidth: 1,
      radius: 4,
      z: 2,
    }),
  ];

  const badgeSpec = {
    key: 'artwork',
    height: () => 100,
    make: (ctx, rect) => {
      const circleW = 90;
      const circleRect = {
        x: rect.x + Math.round((rect.w - circleW) / 2),
        y: rect.y,
        w: circleW,
        h: circleW,
      };
      const circlePlate = shapeItem(ctx, 'award-badge-plate', circleRect, {
        fill: isDarkEmphasis ? tokens.dark : tint(tokens.primary, 0.92),
        stroke: borderStroke,
        strokeWidth: 3,
        radius: Math.round(circleW / 2),
        z: 3,
      });
      const icon = iconItem(ctx, 'award-badge-icon', {
        x: circleRect.x + 15,
        y: circleRect.y + 15,
        w: circleW - 30,
        h: circleW - 30,
      }, { name: ctx.icon || 'award', color: borderStroke, strokeWidth: 2, z: 8 });
      return [circlePlate, icon];
    },
  };

  const overlineSpec = {
    key: 'badge',
    when: (ctx) => Boolean(ctx.words.title_sub || ctx.words.kicker),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'lead');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.title_sub || ctx.words.kicker));
    },
    make: (ctx, rect) => [
      blankItem(ctx, 'title_sub', rect, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'center',
          color: borderStroke,
        },
        z: 11,
      }),
    ],
  };

  const titleSpec = {
    key: 'title',
    height: (ctx, width) => {
      const style = textStyle(ctx, 'heading');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.headline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'headline', rect, {
        style: {
          ...textStyle(ctx, 'heading'),
          align: 'center',
          color: isDarkEmphasis ? '#ffffff' : tokens.primary,
        },
        z: 11,
      }),
    ],
  };

  const ruleSpec = {
    key: 'rule',
    thin: true,
    height: () => 4,
    make: (ctx, rect) => [
      shapeItem(ctx, 'award-rule', {
        x: rect.x + Math.round((rect.w - Math.min(rect.w, 360)) / 2),
        y: rect.y,
        w: Math.min(rect.w, 360),
        h: 4,
      }, {
        fill: borderStroke,
        stroke: borderStroke,
        strokeWidth: 2,
        z: 3,
      }),
    ],
  };

  const taglineSpec = {
    key: 'tagline',
    when: (ctx) => Boolean(ctx.words.tagline && String(ctx.words.tagline).trim()),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.tagline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'tagline', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'center',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const slogans = slogansSpec(c, { align: 'center' });

  const detailsSpec = {
    key: 'details',
    when: (ctx) => Array.isArray(ctx.words.details) && ctx.words.details.length > 0,
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.details));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'details', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'center',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const factsSpec = {
    key: 'facts',
    height: (ctx, width) => factHeight(ctx, width),
    make: (ctx, rect) => factBlock(ctx, rect, { fillOverride: cardFill, strokeOverride: cardStroke, align: 'center' }),
  };

  const ctaSpec = {
    key: 'cta',
    height: (ctx, width) => ctaHeight(ctx, width),
    make: (ctx, rect) => ctaBlock(ctx, rect, { centre: true, fillOverride: tokens.primary }),
  };

  const specs = isBadgeBelow
    ? [overlineSpec, titleSpec, badgeSpec, ruleSpec, taglineSpec, slogans, detailsSpec, factsSpec, ctaSpec]
    : [badgeSpec, overlineSpec, titleSpec, ruleSpec, taglineSpec, slogans, detailsSpec, factsSpec, ctaSpec];

  const innerItems = stack(c, innerBox, specs);
  return collect(c, [...frames, ...innerItems]);
}

/**
 * 6. Agenda Archetype (Education / Workshop / Corporate)
 * Kicker, headline, tagline, divider rule, schedule plate with details, 3 equal info cards, left-aligned.
 */
export function agendaRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, { ...options, align: 'left' }, design);
  const tokens = c.tokens;
  const isReordered = c.options.variant === 1;
  const isDarkEmphasis = c.options.variant === 2;
  const isTitleScale = c.options.variant === 3;

  const cardFill = isDarkEmphasis ? tokens.dark : tint(tokens.primary, 0.94);
  const cardStroke = isDarkEmphasis ? tokens.accent : tint(tokens.primary, 0.72);
  const headlineSize = isTitleScale ? 120 : 100;

  const kickerSpec = {
    key: 'kicker',
    when: (ctx) => Boolean(ctx.words.title_sub || ctx.words.kicker),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'lead');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.title_sub || ctx.words.kicker));
    },
    make: (ctx, rect) => [
      blankItem(ctx, 'title_sub', rect, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'left',
          color: tokens.primary,
        },
        z: 11,
      }),
    ],
  };

  const titleSpec = {
    key: 'title',
    height: (ctx, width) => {
      const face = ROLE_LOOK.heading(ctx);
      const fitSize = fitWordSize(
        ctx.words.headline,
        width,
        fitTextSize({ text: ctx.words.headline, width, size: headlineSize, min: 48, face }),
        face,
        MIN_RECIPE_FONT
      );
      const style = { ...textStyle(ctx, 'heading'), size: fitSize };
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.headline));
    },
    make: (ctx, rect) => {
      const face = ROLE_LOOK.heading(ctx);
      const fitSize = fitWordSize(
        ctx.words.headline,
        rect.w,
        fitTextSize({ text: ctx.words.headline, width: rect.w, size: headlineSize, min: 48, face }),
        face,
        MIN_RECIPE_FONT
      );
      return [
        fieldItem(ctx, 'headline', rect, {
          style: {
            ...textStyle(ctx, 'heading'),
            fontFamily: tokens.headingFont,
            size: fitSize,
            align: 'left',
            color: tokens.primary,
          },
          z: 11,
        }),
      ];
    },
  };

  const taglineSpec = {
    key: 'tagline',
    when: (ctx) => Boolean(ctx.words.tagline && String(ctx.words.tagline).trim()),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.tagline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'tagline', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'left',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const ruleSpec = {
    key: 'rule',
    thin: true,
    height: () => 4,
    make: (ctx, rect) => [
      shapeItem(ctx, 'agenda-rule', { x: rect.x, y: rect.y, w: rect.w, h: 4 }, {
        fill: tokens.accent,
        stroke: tokens.accent,
        strokeWidth: 2,
        z: 3,
      }),
    ],
  };

  const slogans = slogansSpec(c, { align: 'left' });

  const scheduleSpec = {
    key: 'schedule',
    when: (ctx) => Array.isArray(ctx.words.details) && ctx.words.details.length > 0,
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      const textH = estimatedTextHeight({ w: width - 40, style }, ctx.words.details);
      return Math.max(160, textH + 80);
    },
    make: (ctx, rect) => {
      const plate = shapeItem(ctx, 'agenda-sched-plate', rect, {
        fill: cardFill,
        stroke: cardStroke,
        strokeWidth: 1,
        radius: 16,
        z: 2,
      });
      const schedTitle = textItem(ctx, 'agenda-sched-title', 'SCHEDULE & AGENDA', {
        x: rect.x + 20,
        y: rect.y + 16,
        w: rect.w - 40,
        h: 28,
      }, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'left',
          color: tokens.primary,
        },
        z: 11,
      });
      const details = fieldItem(ctx, 'details', {
        x: rect.x + 20,
        y: rect.y + 54,
        w: rect.w - 40,
        h: rect.h - 70,
      }, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'left',
          color: tokens.text,
        },
        z: 11,
      });
      return [plate, schedTitle, details];
    },
  };

  const factsSpec = {
    key: 'facts',
    height: () => factHeight(c, c.box.w),
    make: (ctx, rect) => factBlock(ctx, rect, { fillOverride: cardFill, strokeOverride: cardStroke, align: 'left' }),
  };

  const ctaSpec = {
    key: 'cta',
    height: (ctx, width) => ctaHeight(ctx, width),
    make: (ctx, rect) => ctaBlock(ctx, rect, { centre: false, fillOverride: tokens.primary }),
  };

  const ordered = isReordered
    ? [scheduleSpec, factsSpec, kickerSpec, titleSpec, taglineSpec, ruleSpec, slogans, ctaSpec]
    : [kickerSpec, titleSpec, taglineSpec, ruleSpec, slogans, scheduleSpec, factsSpec, ctaSpec];

  return collect(c, stack(c, c.box, ordered));
}

/**
 * 7. Notice Archetype (Official Notice / Announcement)
 * Double frame border, official notice header banner, headline, tagline, details, center-aligned.
 */
export function noticeRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, { ...options, align: 'center' }, design);
  const tokens = c.tokens;
  const isFrameless = c.options.variant === 1;
  const isDarkEmphasis = c.options.variant === 2;
  const isTitleScale = c.options.variant === 3;

  const bannerFill = isDarkEmphasis ? tokens.dark : tokens.primary;
  const bannerText = pickReadableColor(['#ffffff', '#000000', tokens.accent], bannerFill, 4.5);
  const cardFill = isDarkEmphasis ? shade(tokens.dark, 0.2) : tint(tokens.primary, 0.94);
  const cardStroke = isDarkEmphasis ? tokens.accent : tint(tokens.primary, 0.72);
  const headlineSize = isTitleScale ? 120 : 100;

  const outerPad = isFrameless ? 0 : 10;
  const outerFrame = {
    x: c.box.x + outerPad,
    y: c.box.y + outerPad,
    w: c.box.w - outerPad * 2,
    h: c.box.h - outerPad * 2,
  };
  const innerPad = isFrameless ? 0 : 20;
  const innerBox = {
    x: outerFrame.x + innerPad,
    y: outerFrame.y + innerPad,
    w: outerFrame.w - innerPad * 2,
    h: outerFrame.h - innerPad * 2,
  };

  const frames = isFrameless
    ? []
    : [
        shapeItem(c, 'notice-border-outer', outerFrame, {
          fill: '',
          stroke: tokens.primary,
          strokeWidth: 4,
          radius: 8,
          z: 1,
        }),
        shapeItem(c, 'notice-border-inner', {
          x: outerFrame.x + 12,
          y: outerFrame.y + 12,
          w: outerFrame.w - 24,
          h: outerFrame.h - 24,
        }, {
          fill: '',
          stroke: tint(tokens.primary, 0.5),
          strokeWidth: 1,
          radius: 4,
          z: 2,
        }),
      ];

  const bandSpec = {
    key: 'band',
    height: () => 54,
    make: (ctx, rect) => {
      const plate = shapeItem(ctx, 'notice-band-plate', rect, {
        fill: bannerFill,
        radius: 6,
        z: 3,
      });
      const text = textItem(ctx, 'notice-band-text', 'OFFICIAL ADMINISTRATIVE NOTICE', {
        x: rect.x + 16,
        y: rect.y + 12,
        w: rect.w - 32,
        h: 30,
      }, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'center',
          color: bannerText,
        },
        z: 11,
      });
      return [plate, text];
    },
  };

  const kickerSpec = {
    key: 'kicker',
    when: (ctx) => Boolean(ctx.words.title_sub || ctx.words.kicker),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'lead');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.title_sub || ctx.words.kicker));
    },
    make: (ctx, rect) => [
      blankItem(ctx, 'title_sub', rect, {
        style: {
          ...textStyle(ctx, 'lead'),
          align: 'center',
          color: tokens.accent,
        },
        z: 11,
      }),
    ],
  };

  const titleSpec = {
    key: 'title',
    height: (ctx, width) => {
      const face = ROLE_LOOK.heading(ctx);
      const fitSize = fitWordSize(
        ctx.words.headline,
        width,
        fitTextSize({ text: ctx.words.headline, width, size: headlineSize, min: 48, face }),
        face,
        MIN_RECIPE_FONT
      );
      const style = { ...textStyle(ctx, 'heading'), size: fitSize };
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.headline));
    },
    make: (ctx, rect) => {
      const face = ROLE_LOOK.heading(ctx);
      const fitSize = fitWordSize(
        ctx.words.headline,
        rect.w,
        fitTextSize({ text: ctx.words.headline, width: rect.w, size: headlineSize, min: 48, face }),
        face,
        MIN_RECIPE_FONT
      );
      return [
        fieldItem(ctx, 'headline', rect, {
          style: {
            ...textStyle(ctx, 'heading'),
            fontFamily: tokens.headingFont,
            size: fitSize,
            align: 'center',
            color: tokens.primary,
          },
          z: 11,
        }),
      ];
    },
  };

  const taglineSpec = {
    key: 'tagline',
    when: (ctx) => Boolean(ctx.words.tagline && String(ctx.words.tagline).trim()),
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.tagline));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'tagline', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'center',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const ruleSpec = {
    key: 'rule',
    thin: true,
    height: () => 4,
    make: (ctx, rect) => [
      shapeItem(ctx, 'notice-rule', { x: rect.x, y: rect.y, w: rect.w, h: 4 }, {
        fill: tokens.accent,
        stroke: tokens.accent,
        strokeWidth: 2,
        z: 3,
      }),
    ],
  };

  const slogans = {
    key: 'slogans',
    when: (ctx) => {
      const s1 = ctx.words.slogan_1 && String(ctx.words.slogan_1).trim() && !ctx.dropped.has('slogan_1');
      const s2 = ctx.words.slogan_2 && String(ctx.words.slogan_2).trim() && !ctx.dropped.has('slogan_2');
      return Boolean(s1 || s2);
    },
    height: (ctx, width) => {
      let h = 0;
      const s1 = ctx.words.slogan_1 && String(ctx.words.slogan_1).trim() && !ctx.dropped.has('slogan_1');
      const s2 = ctx.words.slogan_2 && String(ctx.words.slogan_2).trim() && !ctx.dropped.has('slogan_2');
      if (s1) h += Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style: textStyle(ctx, 'lead') }, ctx.words.slogan_1));
      if (s2) {
        if (h > 0) h += 8;
        h += Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style: textStyle(ctx, 'regular') }, ctx.words.slogan_2));
      }
      return h;
    },
    make: (ctx, rect) => {
      const items = [];
      let cursor = rect.y;
      const s1 = ctx.words.slogan_1 && String(ctx.words.slogan_1).trim() && !ctx.dropped.has('slogan_1');
      const s2 = ctx.words.slogan_2 && String(ctx.words.slogan_2).trim() && !ctx.dropped.has('slogan_2');
      if (s1) {
        const style1 = { ...textStyle(ctx, 'lead'), align: 'center' };
        const h1 = Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: rect.w, style: style1 }, s1));
        items.push(blankItem(ctx, 'slogan_1', { x: rect.x, y: cursor, w: rect.w, h: h1 }, { style: style1, z: 11 }));
        cursor += h1 + 8;
      }
      if (s2) {
        const style2 = { ...textStyle(ctx, 'regular'), align: 'center' };
        const h2 = Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: rect.w, style: style2 }, s2));
        items.push(blankItem(ctx, 'slogan_2', { x: rect.x, y: cursor, w: rect.w, h: h2 }, { style: style2, z: 11 }));
      }
      return items;
    },
  };

  const detailsSpec = {
    key: 'details',
    when: (ctx) => Array.isArray(ctx.words.details) && ctx.words.details.length > 0,
    height: (ctx, width) => {
      const style = textStyle(ctx, 'regular');
      return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.details));
    },
    make: (ctx, rect) => [
      fieldItem(ctx, 'details', rect, {
        style: {
          ...textStyle(ctx, 'regular'),
          align: 'center',
          color: tokens.text,
        },
        z: 11,
      }),
    ],
  };

  const factsSpec = {
    key: 'facts',
    height: (ctx, width) => {
      const keys = ['date', 'time', 'venue'];
      const gap = 16;
      const padX = 8;
      const cellWidth = Math.max(MIN_TEXT_WIDTH, Math.floor((width - (keys.length - 1) * gap) / keys.length));
      const textWidth = cellWidth - padX * 2;
      const face = ROLE_LOOK.strong(ctx);
      let factSize = ctx.sizes.strong;
      for (const k of keys) {
        const val = String(ctx.words[k] || '').trim();
        if (!val) continue;
        factSize = fitWordSize(val, textWidth, factSize, face, 20);
      }
      let maxTextH = 0;
      for (const k of keys) {
        const val = String(ctx.words[k] || '').trim();
        if (!val) continue;
        const style = { ...textStyle(ctx, 'strong'), size: factSize };
        const h = estimatedTextHeight({ w: textWidth, style, kind: 'field', field: k }, val);
        if (h > maxTextH) maxTextH = h;
      }
      return Math.max(110, maxTextH + 24);
    },
    make: (ctx, rect) => {
      const keys = ['date', 'time', 'venue'];
      const gap = 16;
      const cellWidth = Math.floor((rect.w - (keys.length - 1) * gap) / keys.length);
      const padX = 8;
      const padY = 8;
      const textWidth = cellWidth - padX * 2;
      const textHeight = rect.h - padY * 2;
      const face = ROLE_LOOK.strong(ctx);

      let factSize = ctx.sizes.strong;
      for (const k of keys) {
        const val = String(ctx.words[k] || '').trim();
        if (!val) continue;
        factSize = fitWordSize(val, textWidth, factSize, face, 20);
        while (factSize > 20) {
          const need = estimatedTextHeight({ w: textWidth, kind: 'field', field: k, style: { size: factSize, ...face } }, val);
          if (need <= textHeight) break;
          factSize -= 1;
        }
      }

      const items = [];
      const primary = tokens.primary || ctx.brand.primary;
      const dark = tokens.dark || ctx.brand.dark || '#0F172A';
      const textColor = pickReadableColor(
        [primary ? shade(primary, 0.45) : '#0f172a', dark, ctx.brand.ink, ctx.brand.body, '#111827', '#000000', '#ffffff'],
        cardFill,
        4.5
      );
      const style = {
        ...textStyle(ctx, 'strong', { align: 'center', color: textColor }),
        size: factSize,
      };

      keys.forEach((key, index) => {
        const cardX = rect.x + index * (cellWidth + gap);
        const cardRect = { x: cardX, y: rect.y, w: cellWidth, h: rect.h };

        items.push(
          shapeItem(ctx, `card-${key}`, cardRect, {
            fill: cardFill,
            stroke: cardStroke,
            strokeWidth: 1,
            radius: 12,
            z: 2,
          })
        );

        const textRect = {
          x: cardX + padX,
          y: rect.y + padY,
          w: textWidth,
          h: textHeight,
        };

        items.push(fieldItem(ctx, key, textRect, { style, z: 11 }));
      });

      return items;
    },
  };

  const ctaSpec = {
    key: 'cta',
    height: (ctx, width) => {
      const hasLine = Boolean(ctx.words.cta_line && String(ctx.words.cta_line).trim() && !isDropped(ctx, 'cta_line'));
      const lineH = hasLine
        ? Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style: textStyle(ctx, 'lead') }, ctx.words.cta_line)) + 16
        : 0;
      const btnStyle = textStyle(ctx, 'button');
      const btnWords = buttonWords(ctx);
      const measured = estimatedTextHeight({ w: width - 32, style: btnStyle }, btnWords);
      const btnH = Math.max(54, measured + 20);
      return lineH + btnH;
    },
    make: (ctx, rect) => {
      const items = [];
      let cursor = rect.y;
      const hasLine = Boolean(ctx.words.cta_line && String(ctx.words.cta_line).trim() && !isDropped(ctx, 'cta_line'));
      if (hasLine) {
        const lineStyle = textStyle(ctx, 'lead');
        const lineH = Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: rect.w, style: lineStyle }, ctx.words.cta_line));
        items.push(
          blankItem(ctx, 'cta_line', { x: rect.x, y: cursor, w: rect.w, h: lineH }, {
            style: { ...lineStyle, align: 'center' },
            z: 11,
          })
        );
        cursor += lineH + 16;
      }
      const btnStyle = textStyle(ctx, 'button');
      const btnWords = buttonWords(ctx);
      const measured = estimatedTextHeight({ w: rect.w - 32, style: btnStyle }, btnWords);
      const btnH = Math.max(54, measured + 20);
      const barBox = { x: rect.x, y: cursor, w: rect.w, h: btnH };
      items.push(
        plateItem(ctx, 'button-plate', barBox, {
          fill: bannerFill,
          radius: 12,
          z: 5,
        })
      );
      items.push(
        blankItem(ctx, 'cta_button', barBox, {
          style: {
            ...btnStyle,
            align: 'center',
            color: pickReadableColor(['#ffffff', '#000000', tokens.dark], bannerFill, 4.5),
          },
          z: 12,
        })
      );
      return items;
    },
  };

  const specs = [bandSpec, kickerSpec, titleSpec, taglineSpec, ruleSpec, slogans, detailsSpec, factsSpec, ctaSpec];

  const innerItems = stack(c, innerBox, specs);
  return collect(c, [...frames, ...innerItems]);
}

/**
 * 8. Split Color Archetype (Awareness / Health / Sports / Community)
 * Split two-column layout: colored left panel, light right panel with details & CTA, left-aligned.
 */
export function splitColorRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, { ...options, align: 'left' }, design);
  const tokens = c.tokens;
  const isMirrored = c.options.variant === 1;
  const isDarkEmphasis = c.options.variant === 2;
  const isTitleScale = c.options.variant === 3;

  const leftFill = isDarkEmphasis ? tokens.dark : tokens.primary;
  const leftText = pickReadableColor(['#ffffff', '#000000', tokens.accent], leftFill, 4.5);
  const leftMuted = pickReadableColor([tint(leftText, 0.25), '#ffffff', '#000000'], leftFill, 4.5);

  const rightFill = isDarkEmphasis ? shade(tokens.dark, 0.25) : tint(tokens.primary, 0.96);
  const rightBorder = tokens.accent;
  const rightText = pickReadableColor([tokens.text, tokens.dark, '#000000', '#ffffff'], rightFill, 4.5);

  const colGap = 20;
  const leftW = Math.floor((c.box.w - colGap) * 0.48);
  const rightW = c.box.w - leftW - colGap;

  const leftX = isMirrored ? c.box.x + rightW + colGap : c.box.x;
  const rightX = isMirrored ? c.box.x : c.box.x + leftW + colGap;

  const leftBox = { x: leftX, y: c.box.y, w: leftW, h: c.box.h };
  const rightBox = { x: rightX, y: c.box.y, w: rightW, h: c.box.h };

  const leftPlate = shapeItem(c, 'split-left-plate', leftBox, {
    fill: leftFill,
    stroke: isDarkEmphasis ? tokens.accent : '',
    strokeWidth: isDarkEmphasis ? 1 : 0,
    radius: 20,
    z: 1,
  });

  const rightPlate = shapeItem(c, 'split-right-plate', rightBox, {
    fill: rightFill,
    stroke: rightBorder,
    strokeWidth: 1,
    radius: 20,
    z: 1,
  });

  const leftPad = 24;
  const leftInner = {
    x: leftBox.x + leftPad,
    y: leftBox.y + leftPad,
    w: leftBox.w - leftPad * 2,
    h: leftBox.h - leftPad * 2,
  };

  const rightPad = 24;
  const rightInner = {
    x: rightBox.x + rightPad,
    y: rightBox.y + rightPad,
    w: rightBox.w - rightPad * 2,
    h: rightBox.h - rightPad * 2,
  };

  const headlineSize = isTitleScale ? 88 : 96;

  const leftSpecs = [
    {
      key: 'artwork',
      height: () => 60,
      make: (ctx, rect) => [
        iconItem(ctx, 'split-left-icon', {
          x: rect.x,
          y: rect.y,
          w: 60,
          h: 60,
        }, { name: ctx.icon || 'leaf', color: tokens.accent, strokeWidth: 2, z: 8 }),
      ],
    },
    {
      key: 'badge',
      when: (ctx) => Boolean(ctx.words.title_sub || ctx.words.kicker),
      height: (ctx, width) => {
        const style = textStyle(ctx, 'lead');
        return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.title_sub || ctx.words.kicker));
      },
      make: (ctx, rect) => [
        blankItem(ctx, 'title_sub', rect, {
          style: {
            ...textStyle(ctx, 'lead'),
            align: 'left',
            color: leftMuted,
          },
          z: 11,
        }),
      ],
    },
    {
      key: 'title',
      height: (ctx, width) => {
        const face = ROLE_LOOK.heading(ctx);
        const baseSize = isTitleScale ? 88 : 96;
        const targetSize = Math.min(ctx.sizes.heading, baseSize);
        const size = fitWordSize(ctx.words.headline, width, targetSize, face, 20);
        const style = { ...textStyle(ctx, 'heading'), size };
        return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.headline));
      },
      make: (ctx, rect) => {
        const face = ROLE_LOOK.heading(ctx);
        const baseSize = isTitleScale ? 88 : 96;
        const targetSize = Math.min(ctx.sizes.heading, baseSize);
        const size = fitWordSize(ctx.words.headline, rect.w, targetSize, face, 20);
        const style = {
          ...textStyle(ctx, 'heading'),
          align: 'left',
          color: leftText,
          size,
        };
        return [
          fieldItem(ctx, 'headline', rect, {
            style,
            z: 11,
          }),
        ];
      },
    },
    {
      key: 'tagline',
      when: (ctx) => Boolean(ctx.words.tagline && String(ctx.words.tagline).trim()),
      height: (ctx, width) => {
        const style = textStyle(ctx, 'regular');
        return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.tagline));
      },
      make: (ctx, rect) => [
        fieldItem(ctx, 'tagline', rect, {
          style: {
            ...textStyle(ctx, 'regular'),
            align: 'left',
            color: leftMuted,
          },
          z: 11,
        }),
      ],
    },
    {
      key: 'facts',
      height: (ctx, width) => factRowsHeight(ctx, width),
      make: (ctx, rect) => factRowsBlock(ctx, rect, { fillOverride: shade(leftFill, 0.2), strokeOverride: tokens.accent }),
    },
  ];

  const rightSpecs = [
    slogansSpec(c, { align: 'left' }),
    {
      key: 'details',
      when: (ctx) => Array.isArray(ctx.words.details) && ctx.words.details.length > 0,
      height: (ctx, width) => {
        const style = textStyle(ctx, 'regular');
        return Math.max(ELEMENT_LIMITS.minHeight, estimatedTextHeight({ w: width, style }, ctx.words.details));
      },
      make: (ctx, rect) => [
        fieldItem(ctx, 'details', rect, {
          style: {
            ...textStyle(ctx, 'regular'),
            align: 'left',
            color: rightText,
          },
          z: 11,
        }),
      ],
    },
    {
      key: 'cta',
      height: (ctx, width) => ctaHeight(ctx, width),
      make: (ctx, rect) => ctaBlock(ctx, rect, { centre: false, fillOverride: leftFill }),
    },
  ];

  let chosenPlan = c;
  let leftLaid = null;
  let rightLaid = null;

  for (let dropCount = 0; dropCount <= DROP_ORDER.length; dropCount += 1) {
    const dropped = new Set(DROP_ORDER.slice(0, dropCount));
    for (const scale of SCALES) {
      const plan = planOf(c, scale, dropped);
      const lLaid = layoutOf(plan, leftInner, leftSpecs);
      const rLaid = layoutOf(plan, rightInner, rightSpecs);
      if ((lLaid.fits && rLaid.fits) || (dropCount === DROP_ORDER.length && scale === SCALES[SCALES.length - 1])) {
        chosenPlan = plan;
        leftLaid = lLaid;
        rightLaid = rLaid;
        break;
      }
    }
    if (leftLaid && rightLaid) break;
  }

  const buildItems = (plan, box, laid) => {
    const items = [];
    let cursor = box.y + Math.max(0, Math.round(laid.spare / 2));
    laid.live.forEach((spec, index) => {
      const rect = { x: box.x, y: cursor, w: box.w, h: laid.heights[index] };
      const made = spec.make(plan, rect);
      items.push(...(Array.isArray(made) ? made : [made]));
      cursor += laid.heights[index] + (laid.gaps[index] || 0);
    });
    return items;
  };

  const leftItems = buildItems(chosenPlan, leftInner, leftLaid);
  const rightItems = buildItems(chosenPlan, rightInner, rightLaid);

  return collect(c, [leftPlate, rightPlate, ...leftItems, ...rightItems]);
}

/* ------------------------------------------------------------------------- *
 * Backward-compatible legacy recipe aliases
 * ------------------------------------------------------------------------- */

export function heroRecipe(area, brandKit, slots, options = {}, design = null) {
  return ticketRecipe(area, brandKit, slots, options, design);
}

export function photoTopRecipe(area, brandKit, slots, options = {}, design = null) {
  return photoHeroRecipe(area, brandKit, slots, options, design);
}

export function splitPhotoRecipe(area, brandKit, slots, options = {}, design = null) {
  return splitColorRecipe(area, brandKit, slots, options, design);
}

export function typographicRecipe(area, brandKit, slots, options = {}, design = null) {
  return boldTypeRecipe(area, brandKit, slots, options, design);
}

export function boldBandRecipe(area, brandKit, slots, options = {}, design = null) {
  return splitColorRecipe(area, brandKit, slots, options, design);
}

/** Decorations go behind the design; the words then take the colour that reads on them. */
function collect(c, items) {
  const area = c.area;
  const list = Array.isArray(items) ? items : [];
  const extras = decorationBlock(c, area);
  const merged = [...extras, ...list].map((item) => ({
    ...item,
    ...clampRectToArea({ x: item.x, y: item.y, w: item.w, h: item.h }, area),
  }));
  const readable = readableInks(merged, { surface: c.surface, candidates: c.inks });
  return readable.slice(0, ELEMENT_LIMITS.maxItems);
}

/* ------------------------------------------------------------------------- *
 * The recipe list
 * ------------------------------------------------------------------------- */

export const DESIGN_RECIPES = [
  {
    id: 'bold-type',
    name: 'Bold Type',
    suits: ['notice', 'education', 'corporate', 'meeting', 'general', 'awareness'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: boldTypeRecipe,
  },
  {
    id: 'photo-hero',
    name: 'Photo Hero',
    suits: ['sports', 'festival', 'celebration', 'health', 'awareness', 'education', 'general'],
    needsPhoto: true,
    recipeVersion: RECIPE_VERSION,
    recipe: photoHeroRecipe,
  },
  {
    id: 'date-block',
    name: 'Date Block',
    suits: ['sports', 'festival', 'celebration', 'meeting', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: dateBlockRecipe,
  },
  {
    id: 'ticket',
    name: 'Ticket',
    suits: ['festival', 'celebration', 'sports', 'corporate', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: ticketRecipe,
  },
  {
    id: 'centered-award',
    name: 'Centered Award',
    suits: ['celebration', 'corporate', 'meeting', 'education', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: centeredAwardRecipe,
  },
  {
    id: 'agenda',
    name: 'Agenda',
    suits: ['education', 'corporate', 'meeting', 'awareness', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: agendaRecipe,
  },
  {
    id: 'notice',
    name: 'Official Notice',
    suits: ['notice', 'corporate', 'awareness', 'education', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: noticeRecipe,
  },
  {
    id: 'split-color',
    name: 'Split Color',
    suits: ['awareness', 'health', 'sports', 'festival', 'corporate', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    recipe: splitColorRecipe,
  },
];

export function designById(id) {
  const wanted = typeof id === 'string' ? id.trim().toLowerCase() : '';
  const clean = wanted.replace(/[-_ ]/g, '');
  if (clean === 'hero') return DESIGN_RECIPES.find((d) => d.id === 'ticket') || DESIGN_RECIPES[3];
  if (clean === 'phototop') return DESIGN_RECIPES.find((d) => d.id === 'photo-hero') || DESIGN_RECIPES[1];
  if (clean === 'splitphoto' || clean === 'boldband') return DESIGN_RECIPES.find((d) => d.id === 'split-color') || DESIGN_RECIPES[7];
  if (clean === 'typographic') return DESIGN_RECIPES.find((d) => d.id === 'bold-type') || DESIGN_RECIPES[0];

  return DESIGN_RECIPES.find((design) => design.id.toLowerCase() === wanted || design.id.replace(/[-_ ]/g, '') === clean) || null;
}

export function recipeIds() {
  return DESIGN_RECIPES.map((design) => design.id);
}

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
  const values = slotsOf(slots);
  const elements = design.recipe(box, brandKit, values, opts, design);
  return { elements: normalizeElements(elements), problems: [], design, options: opts };
}
