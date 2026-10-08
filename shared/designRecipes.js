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
const DROP_ORDER = ['title_sub', 'slogan_2', 'details', 'cta_line', 'tagline', 'artwork'];
/** Tried in order before anything is given up, so the words keep their lines. A poster with room
 *  to spare is set larger first, so its blocks reach from the top band to the bottom one. */
const SCALES = [1.6, 1.45, 1.3, 1.15, 1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64];

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
  return item?.kind === 'shape' && item?.shape?.type === 'rect' && Boolean(item?.shape?.fill);
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
  while (size > minSize && Math.ceil(maxWordLen * charWidthOf(size, face)) > width) {
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
  for (let step = 0; step < 40; step += 1) {
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
  return c.dropped.has(key);
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
  const gap = innerGapOverride || c.inner;
  const heights = kept.map((entry) => resolveLine(c, entry, width).height);
  return heights.reduce((acc, height) => acc + height, 0) + gap * (kept.length - 1);
}

/** Place a group of lines in a box, top-down, optionally held in its middle. */
function groupLines(c, entries, rect, { centre = false, innerGap = 0 } = {}) {
  const kept = entries.filter((entry) => hasEntryText(c, entry));
  if (kept.length === 0) return [];
  const gap = innerGap || c.inner;
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

function factHeight(c, width, options) {
  return 110;
}

function factBlock(c, rect, { plate = false } = {}) {
  const keys = ['date', 'time', 'venue'];
  const gap = 16;
  const cellWidth = Math.floor((rect.w - (keys.length - 1) * gap) / keys.length);
  const items = [];

  const fill = tint(c.palette.primary, 0.94);
  const stroke = tint(c.palette.primary, 0.72);

  keys.forEach((key, index) => {
    const cardX = rect.x + index * (cellWidth + gap);
    const cardRect = { x: cardX, y: rect.y, w: cellWidth, h: rect.h };

    // 1. Separate card shape (1px border, 12px radius, light tint of primary)
    items.push(
      shapeItem(c, `card-${key}`, cardRect, {
        fill,
        stroke,
        strokeWidth: 1,
        radius: 12,
        z: 2,
      })
    );

    const val = String(c.words[key] || (key === 'venue' ? 'Venue to be announced' : '')).trim();
    const isLongVenue = key === 'venue' && val.length > 18;
    const valueSize = isLongVenue ? 24 : 32;

    const padX = 8;
    const padY = 8;
    const textRect = {
      x: cardX + padX,
      y: rect.y + padY,
      w: cellWidth - padX * 2,
      h: rect.h - padY * 2,
    };

    const style = {
      ...textStyle(c, 'regular'),
      size: valueSize,
      weight: 700,
      align: 'center',
      showLabel: true,
      showIcon: false,
      color: c.palette.primary ? shade(c.palette.primary, 0.45) : '#0f172a',
    };

    items.push(fieldItem(c, key, textRect, { style, z: 11 }));
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
  return (hasLine ? 32 + 16 : 0) + 54;
}

function ctaBlock(c, rect, { centre = false } = {}) {
  const items = [];
  let cursor = rect.y;
  const align = centre || c.align === 'center' ? 'center' : 'left';

  const hasLine = Boolean(c.words.cta_line && String(c.words.cta_line).trim() && !isDropped(c, 'cta_line'));
  if (hasLine) {
    const lineBox = { x: rect.x, y: cursor, w: rect.w, h: 32 };
    items.push(
      blankItem(c, 'cta_line', lineBox, {
        style: { ...textStyle(c, 'strong'), align, size: 20 },
        z: 11,
      })
    );
    cursor += 32 + 16;
  }

  const barH = 54;
  const barBox = { x: rect.x, y: cursor, w: rect.w, h: barH };

  // Full-width solid label bar
  items.push(
    plateItem(c, 'button-plate', barBox, {
      fill: c.palette.primary || c.palette.accent,
      radius: 12,
      z: 5,
    })
  );

  const barText = buttonWords(c);
  const face = { weight: 700, uppercase: false, letterSpacing: 0 };
  let barSize = 22;
  while (barSize > 16 && Math.ceil(barText.length * charWidthOf(barSize, face)) > rect.w - 32) {
    barSize -= 1;
  }

  const barStyle = {
    ...textStyle(c, 'button'),
    size: barSize,
    weight: 700,
    align,
    color: '#ffffff',
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

/**
 * Everything a block needs, worked out once per design.
 *
 * The `scale` and `dropped` of a plan are what the layout engine moves while it looks for a set of
 * sizes that fits the space between the two brand bands.
 */
function contextOf(area, brandKit, slots, options, design = null) {
  const brand = brandOf(brandKit);
  const box = frameOf(area);
  const unit = spacingUnit(area.w);
  const c = {
    area,
    box,
    brand,
    slots,
    options,
    type: typeOf(options.typeStyle),
    palette: paletteOf(brand, options.palette),
    words: slots,
    facts: FACT_FIELDS.filter((key) => Boolean(slots[key])),
    align: options.variant % 2 === 1 ? 'center' : 'left',
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
  c.icon =
    slots.icon ||
    iconForWords(
      [slots.headline, slots.tagline, slots.venue, ...slots.details].filter(Boolean).join(' '),
      design?.suits?.[0] || 'general'
    );
  return c;
}

/** The same design at another size, or with another line given up. */
function planOf(c, scale, dropped) {
  const next = { ...c, scale, dropped: dropped || c.dropped };
  next.sizes = sizesOf(c.type, c.area.w, c.box.h, scale);
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
  if (kA === 'photo' && (kB === 'title' || kB === 'kicker')) return 32;
  if (kA === 'title' && (kB === 'pill' || kB === 'facts' || kB === 'fact')) return 48;
  if ((kA === 'pill' || kA === 'facts' || kA === 'fact') && (kB === 'words' || kB === 'cta')) return 40;
  if (kA === 'words' && kB === 'cta') return 40;
  if (kA === 'artwork' && (kB === 'pill' || kB === 'facts')) return 48;
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

  while (total > box.h && gaps.some((g, i) => g > minGapBetweenSpecs(live[i], live[i + 1]) * 0.7)) {
    for (let i = 0; i < gaps.length; i += 1) {
      if (gaps[i] > 16) gaps[i] -= 2;
    }
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
  if (leftover > 0 && gaps.length > 0) {
    const extraPerGap = Math.floor(leftover / gaps.length);
    for (let i = 0; i < gaps.length; i += 1) {
      gaps[i] += extraPerGap;
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
  for (let dropCount = 0; dropCount <= DROP_ORDER.length; dropCount += 1) {
    const dropped = new Set(DROP_ORDER.slice(0, dropCount));
    for (const scale of SCALES) {
      const plan = planOf(c, scale, dropped);
      const laid = layoutOf(plan, box, specs);
      const keepsShape = scale <= 1 || laid.live.every((spec) => holdsColumns(plan, spec, box.w));
      if ((laid.fits && keepsShape) || (dropCount === DROP_ORDER.length && scale === SCALES[SCALES.length - 1])) {
        const items = [];
        let cursor = box.y;
        laid.live.forEach((spec, index) => {
          const rect = { x: box.x, y: cursor, w: box.w, h: laid.heights[index] };
          const made = spec.make(plan, rect);
          items.push(...(Array.isArray(made) ? made : [made]));
          cursor += laid.heights[index] + (laid.gaps[index] || 0);
        });
        return items;
      }
    }
  }
  return [];
}

/* ------------------------------------------------------------------------- *
 * The recipes
 * ------------------------------------------------------------------------- */

/**
 * The poster the brief asks for: a two-tier title, one round mark with a large picture on one
 * side and one slogan block beside it, a pill of facts, and a call to action with a button.
 *
 * The line under the title and the list of extra lines are not drawn here at all - other designs
 * carry them.
 */
function heroRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, options, design);
  const stacked = c.options.variant >= 2;
  const artLeft = c.options.variant % 2 === 1;

  return collect(
    c,
    stack(c, c.box, [
      {
        key: 'title',
        height: (ctx, width) => titleHeight(ctx, width, { includeTagline: false }),
        make: (ctx, rect) => titleBlock(ctx, rect, { includeTagline: false }),
      },
      {
        key: 'artwork',
        flex: true,
        /* The middle is as tall as its own words: it may grow with the space left over, but it is
           never cut, because cutting it would push the slogan lines into the pill below. */
        min: (ctx, width) => heroMiddleHeight(ctx, width, { stacked }),
        height: (ctx, width) => heroMiddleHeight(ctx, width, { stacked }),
        /* The round mark is a circle, so past its own width the block would only be empty. */
        ceiling: (ctx) => (ctx.options.variant >= 2 ? 0 : heroArtWidth(ctx, ctx.box.w)),
        height: (ctx, width) => heroMiddleHeight(ctx, width, { stacked }),
        make: (ctx, rect) => heroMiddle(ctx, rect, { stacked, artLeft }),
      },
      {
        key: 'pill',
        columns: { plate: true },
        when: (ctx) => ctx.facts.length > 0,
        height: (ctx, width) => factHeight(ctx, width, { plate: true }),
        make: (ctx, rect) => factBlock(ctx, rect, { plate: true }),
      },
      {
        key: 'cta',
        height: (ctx, width) => ctaHeight(ctx, width),
        make: (ctx, rect) => ctaBlock(ctx, rect, { centre: true }),
      },
    ])
  );
}

/**
 * How the middle of a hero is split. Worked out from the width alone, so the height the block is
 * given and the boxes the words are placed in can never disagree.
 */
const HERO_ART_SHARE = 0.36;

function heroWordsWidth(c, width, { stacked }) {
  if (stacked) return Math.max(MIN_TEXT_WIDTH, width);
  const art = heroArtWidth(c, width);
  return Math.max(MIN_TEXT_WIDTH, width - art - ruleThicknessOf(c.area.w) - heroSplitPad(c) * 2);
}

function heroArtWidth(c, width) {
  return Math.max(ELEMENT_LIMITS.minWidth, Math.round(width * HERO_ART_SHARE));
}

function heroSplitPad(c) {
  return Math.max(8, Math.round(c.unit * 0.9));
}

/** The round mark is never smaller than this, and never wider than a fifth of the poster. */
function heroMiddleMin(c) {
  return Math.max(60, Math.min(Math.round(c.box.h * 0.34), Math.round(c.box.w * 0.2)));
}

/** When the mark sits above the slogan instead of beside it, that is the square it takes. */
function heroStackedSide(c) {
  return Math.max(60, Math.round(heroMiddleMin(c) * 0.7));
}

function heroWordsEntries(c) {
  const slogans = sloganEntries(c).filter((e) => hasEntryText(c, e));
  if (slogans.length > 0) return slogans;
  if (c.hasWords('details')) {
    return [fieldLine('details', 'details', 'regular')];
  }
  return [];
}

function heroMiddleHeight(c, width, { stacked }) {
  const words = heroWordsEntries(c);
  if (words.length === 0) {
    return heroMiddleMin(c);
  }
  const wordsH = groupHeight(c, words, heroWordsWidth(c, width, { stacked }));
  return Math.max(heroMiddleMin(c), wordsH + (stacked ? heroStackedSide(c) + c.inner : 0));
}

/** The middle of a hero: round mark and text, or full-width centered mark when text is empty. */
function heroMiddle(c, rect, { stacked, artLeft }) {
  const words = heroWordsEntries(c);
  if (words.length === 0) {
    return artBlock(c, rect, { centre: true });
  }

  if (stacked) {
    const side = Math.min(rect.w, heroStackedSide(c));
    const art = { x: rect.x + Math.round((rect.w - side) / 2), y: rect.y, w: side, h: side };
    const wordsRect = {
      x: rect.x,
      y: art.y + side + c.inner,
      w: rect.w,
      h: Math.max(ELEMENT_LIMITS.minHeight, rect.y + rect.h - (art.y + side + c.inner)),
    };
    return [...artBlock(c, art, { centre: false }), ...groupLines(c, words, wordsRect, { centre: true })];
  }

  const rule = ruleThicknessOf(c.area.w);
  const pad = heroSplitPad(c);
  const artW = heroArtWidth(c, rect.w);
  const wordsW = heroWordsWidth(c, rect.w, { stacked });
  const art = {
    x: artLeft ? rect.x : rect.x + rect.w - artW,
    y: rect.y,
    w: artW,
    h: rect.h,
  };
  const wordsRect = {
    x: artLeft ? rect.x + artW + rule + pad * 2 : rect.x,
    y: rect.y,
    w: wordsW,
    h: rect.h,
  };
  const ruleX = artLeft ? rect.x + artW + pad : rect.x + wordsW + pad;
  const divider = Math.round(rect.h * PILL_DIVIDER_RATIO);
  const square = squareIn(art);
  const items = artBlock(c, square, { centre: false });
  items.push(ruleItem(c, 'middle-rule', { x: ruleX, y: rect.y + Math.round((rect.h - divider) / 2), w: rule, h: divider }));
  items.push(...groupLines(c, words, wordsRect, { centre: true }));
  return items;
}

/** The picture itself, as one block of the design. */
function photoSpec(c, { radius = 24 } = {}) {
  return {
    key: 'photo',
    flex: true,
    min: () => Math.max(120, Math.round(c.box.h * 0.26)),
    height: (ctx, width) => Math.max(120, Math.round(Math.min(ctx.box.h * 0.34, width * 0.6))),
    make: (ctx, rect) => [
      fieldItem(ctx, 'photo', rect, { style: { ...textStyle(ctx, 'regular'), radius, fit: 'cover' }, z: 4 }),
    ],
  };
}

function photoTopRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, options, design);
  const factsFirst = c.options.variant >= 2;
  const words = wordsEntries();

  const specs = [
    photoSpec(c, { radius: 24 }),
    {
      key: 'title',
      height: (ctx, width) => titleHeight(ctx, width, {}),
      make: (ctx, rect) => titleBlock(ctx, rect, {}),
    },
    {
      key: 'pill',
      columns: { plate: false },
      when: (ctx) => ctx.facts.length > 0,
      height: (ctx, width) => factHeight(ctx, width, { plate: false }),
      make: (ctx, rect) => factBlock(ctx, rect, { plate: false }),
    },
    {
      key: 'words',
      when: (ctx) => wordsEntries(ctx).some((e) => hasEntryText(ctx, e)),
      height: (ctx, width) => wordsHeight(ctx, width, words),
      make: (ctx, rect) => wordsBlock(ctx, rect, words),
    },
    {
      key: 'cta',
      height: (ctx, width) => ctaHeight(ctx, width),
      make: (ctx, rect) => ctaBlock(ctx, rect),
    },
  ];

  const ordered = factsFirst ? [specs[2], ...specs.filter((spec) => spec !== specs[2])] : specs;
  const items = collect(c, stack(c, c.box, ordered));
  /* Variant 3 lets the picture run edge to edge; its row keeps the same height and place. */
  if (c.options.variant === 3) {
    const art = items.find((item) => item.id === 'field-photo');
    if (art) {
      art.x = c.area.x;
      art.w = c.area.w;
      art.style.radius = 0;
    }
  }
  return items;
}

function splitPhotoRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, options, design);
  const sideways = c.options.variant < 2;
  const secondSide = c.options.variant % 2 === 1;
  const words = wordsEntries();

  /* Inside a column the blocks are measured against the column, not the whole poster, and stand
     a little closer together than the blocks of the poster itself. */
  const wordsCol = (rect) =>
    stack(
      c,
      rect,
      [
        {
          key: 'title',
          height: (ctx, width) => titleHeight(ctx, width, {}),
          make: (ctx, inner) => titleBlock(ctx, inner, {}),
        },
        {
          key: 'pill',
          columns: { plate: false },
          when: (ctx) => ctx.facts.length > 0,
          height: (ctx, width) => factHeight(ctx, width, { plate: false }),
          make: (ctx, inner) => factBlock(ctx, inner, { plate: false }),
        },
        {
          key: 'words',
          when: (ctx) => wordsEntries(ctx).some((e) => hasEntryText(ctx, e)),
          height: (ctx, width) => wordsHeight(ctx, width, words),
          make: (ctx, inner) => wordsBlock(ctx, inner, words),
        },
        {
          key: 'cta',
          height: (ctx, width) => ctaHeight(ctx, width),
          make: (ctx, inner) => ctaBlock(ctx, inner),
        },
      ],
      Math.max(6, Math.round(c.gap * 0.8))
    );

  const gap = Math.round(sideways ? c.box.w * COL_GAP_RATIO : c.gap);
  const parts = sideways
    ? colsIn(c.box, [0.44, 0.56], gap)
    : rowsIn(c.box, [0.4, 0.6], c.gap);
  const artIndex = secondSide ? 1 : 0;
  const art = parts[artIndex];
  const column = parts[secondSide ? 0 : 1];

  const items = collect(c, [
    fieldItem(c, 'photo', art, { style: { ...textStyle(c, 'regular'), radius: 24, fit: 'cover' }, z: 4 }),
    ...wordsCol(column),
  ]);
  if (c.options.variant === 3) {
    const side = Math.max(ELEMENT_LIMITS.minWidth, Math.round(Math.min(art.w, art.h) * 0.3));
    items.push(
      iconItem(
        c,
        'art-icon',
        { x: art.x + Math.round((art.w - side) / 2), y: art.y + Math.round((art.h - side) / 2), w: side, h: side },
        { name: c.icon, color: c.palette.accent, z: 8 }
      )
    );
  }
  return items;
}

function typographicRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, options, design);
  const words = wordsEntries();

  return collect(
    c,
    stack(c, c.box, [
      {
        key: 'artwork',
        when: (ctx) => ctx.options.artwork !== 'none',
        min: () => Math.max(60, Math.round(c.box.w * 0.1)),
        height: (ctx, width) => Math.max(60, Math.round(Math.min(ctx.box.h * 0.16, width * 0.3))),
        make: (ctx, rect) => artBlock(ctx, rect, { centre: true }),
      },
      {
        key: 'title',
        height: (ctx, width) => titleHeight(ctx, width, {}),
        make: (ctx, rect) => titleBlock(ctx, rect, {}),
      },
      {
        key: 'rule',
        thin: true,
        height: () => ruleThicknessOf(c.area.w),
        make: (ctx, rect) => {
          const side = ruleThicknessOf(ctx.area.w);
          return [ruleItem(ctx, 'title-rule', { ...rect, h: side })];
        },
      },
      {
        key: 'pill',
        columns: { plate: true },
        when: (ctx) => ctx.facts.length > 0,
        height: (ctx, width) => factHeight(ctx, width, { plate: true }),
        make: (ctx, rect) => factBlock(ctx, rect, { plate: true }),
      },
      {
        key: 'words',
        when: (ctx) => wordsEntries(ctx).some((e) => hasEntryText(ctx, e)),
        height: (ctx, width) => wordsHeight(ctx, width, words),
        make: (ctx, rect) => wordsBlock(ctx, rect, words),
      },
      {
        key: 'cta',
        height: (ctx, width) => ctaHeight(ctx, width),
        make: (ctx, rect) => ctaBlock(ctx, rect),
      },
    ])
  );
}

function boldBandRecipe(area, brandKit, slots, options = {}, design = null) {
  const c = contextOf(area, brandKit, slots, options, design);
  const full = c.options.variant >= 2;
  const words = wordsEntries();
  const bandPad = () => Math.max(8, Math.round(c.unit * 0.8));
  const bandHeight = (ctx, width) => {
    const inner = Math.max(MIN_TEXT_WIDTH, width - bandPad() * 2);
    const art = ctx.options.artwork === 'none' ? 0 : Math.round(inner * 0.24);
    return titleHeight(ctx, art > 0 ? inner - art - ctx.inner : inner, {}) + bandPad() * 2;
  };

  const specs = [
    {
      key: 'band',
      flex: true,
      min: bandHeight,
      height: bandHeight,
      make: (ctx, rect) => {
        const plate = shapeItem(ctx, 'title-band', rect, {
          fill: ctx.palette.band,
          radius: full ? 0 : 16,
          z: 2,
        });
        const inner = inset(rect, bandPad(), bandPad());
        const parts =
          ctx.options.artwork === 'none'
            ? [inner, null]
            : colsIn(inner, [0.72, 0.28], Math.round(inner.w * 0.03));
        /* The band owns its words' colour: whatever brand colour reads on it. */
        const onBand = readableColorOn(ctx.palette.band, ctx.inks);
        const banded = {
          ...ctx,
          titleColor: onBand,
          align: 'left',
          inks: [ctx.brand.ink, ctx.brand.body, ctx.brand.light, onBand, ...ctx.inks.slice(3)],
        };
        const title = titleBlock(banded, parts[0], {});
        for (const item of title) {
          if (drawsWords(item)) item.style = { ...item.style, color: onBand };
        }
        const art = parts[1] ? artBlock({ ...banded, align: 'center' }, parts[1], { centre: true }) : [];
        return [plate, ...title, ...art];
      },
    },
    {
      key: 'pill',
      columns: { plate: false },
      when: (ctx) => ctx.facts.length > 0,
      height: (ctx, width) => factHeight(ctx, width, { plate: false }),
      make: (ctx, rect) => factBlock(ctx, rect, { plate: false }),
    },
    {
      key: 'words',
      when: (ctx) => wordsEntries(ctx).some((e) => hasEntryText(ctx, e)),
      height: (ctx, width) => wordsHeight(ctx, width, words),
      make: (ctx, rect) => wordsBlock(ctx, rect, words),
    },
    {
      key: 'cta',
      height: (ctx, width) => ctaHeight(ctx, width),
      make: (ctx, rect) => ctaBlock(ctx, rect),
    },
  ];

  /* Variants 1 and 3 put the date and place above the band. */
  const ordered = c.options.variant % 2 === 1 ? [specs[1], specs[0], specs[2], specs[3]] : specs;
  const items = collect(c, stack(c, c.box, ordered));
  /* Variants 2 and 3 run the band edge to edge; its row keeps its own height and place. */
  if (full) {
    const plate = items.find((item) => item.id === 'title-band');
    if (plate) {
      plate.x = c.area.x;
      plate.w = c.area.w;
    }
  }
  return items;
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
    suits: ['sports', 'festival', 'celebration', 'health', 'awareness', 'education', 'corporate', 'general'],
    needsPhoto: true,
    recipeVersion: RECIPE_VERSION,
    recipe: photoTopRecipe,
  },
  {
    id: 'splitPhoto',
    name: 'Photo beside the words',
    suits: ['sports', 'festival', 'celebration', 'health', 'education', 'meeting', 'corporate', 'notice', 'general'],
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
  const values = slotsOf(slots);
  const elements = design.recipe(box, brandKit, values, opts, design);
  return { elements: normalizeElements(elements), problems: [], design, options: opts };
}
