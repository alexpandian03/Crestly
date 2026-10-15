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

export const ELEMENT_KINDS = ['field', 'text', 'image', 'shape', 'icon', 'cardlist'];

/** Poster words a field element can stand for. */
export const ELEMENT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details', 'photo'];
export const TEXT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details'];

export const TEXT_ALIGNS = ['left', 'center', 'right'];
export const IMAGE_FITS = ['cover', 'contain'];
export const SHAPE_TYPES = ['rect', 'rounded-rect', 'circle', 'line', 'triangle', 'star', 'hexagon', 'diamond'];
export const IMAGE_MASKS = ['none', 'rounded', 'circle', 'triangle', 'hexagon', 'star', 'diamond', 'blob'];

export function isSamplePlaceholder(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  if (!t) return true;
  if (/^sample\b/i.test(t) || /\bsample\b/i.test(t)) return true;
  if (/^a heading of your own/i.test(t) || /^a smaller line under it/i.test(t) || /^a paragraph of plain words/i.test(t)) return true;
  if (/^line above the title/i.test(t) || /^button words/i.test(t) || /^call to action/i.test(t)) return true;
  if (/the person filling this in/i.test(t) || /chooses the picture/i.test(t)) return true;
  if (/^complimentary registration and certificate/i.test(t)) return true;
  if (/^interactive keynote and practical walkthroughs/i.test(t)) return true;
  if (/^networking session with industry practitioners/i.test(t)) return true;
  if (/^empowering communities,? transforming futures/i.test(t)) return true;
  return false;
}

export const GENERIC_VARIABLE_LABELS = [
  'Small line',
  'Heading',
  'Subheading',
  'Body',
  'Photo space',
];

export function isGenericLabel(label) {
  if (!label || typeof label !== 'string') return false;
  const trimmed = label.trim().toLowerCase();
  return GENERIC_VARIABLE_LABELS.some((g) => g.toLowerCase() === trimmed);
}

/**
 * Resolves the image URL to draw for an image item or photo field:
 * 1. An explicit answer in content.images[item.key] takes priority.
 * 2. If empty and the caller marks this as the poster's own picture space - one with no name of
 *    its own, so it has nowhere to hold an answer - the poster photo is bound.
 * 3. Fixed design images keep their own imageUrl.
 * 4. Empty slots return empty string (causing the renderer to omit/hide them).
 *
 * A variable slot's own sample picture is never a fallback here - only the poster's own
 * values are. In the editor or Create preview until filled, sampleImage is shown.
 * Exports NEVER draw sampleImage.
 */
export function resolveItemImage(item, content, photoUrl = '', isFirstUserSlot = false, options = {}) {
  const isExporting = typeof options === 'boolean' ? options : Boolean(options?.isExporting);
  const showSample = typeof options === 'object' && options?.showSample !== undefined ? Boolean(options.showSample) : !isExporting;
  if (!item) return '';
  if (item.kind === 'image') {
    let img = item.variable && content?.images ? String(content.images[item.key] || '').trim() : '';
    if (!img && isFirstUserSlot) {
      img = String(photoUrl || content?.imageUrl || content?.image || '').trim();
    }
    if (!img && !item.variable) {
      img = String(item.imageUrl || item.src || item.url || '').trim();
    }
    if (!img && item.variable && showSample && !isExporting && item.sampleImage) {
      img = String(item.sampleImage).trim();
    }
    return img;
  }
  if (item.field === 'photo') {
    let img = item.variable && content?.images ? String(content.images[item.key] || '').trim() : '';
    if (!img) {
      img = String(photoUrl || content?.imageUrl || content?.image || '').trim();
    }
    return img;
  }
  return '';
}

/**
 * The only pictures an icon item may ask for.
 *
 * Grouped by the kind of event they suit so a design can pick one by itself, and named after
 * the icon set this app already draws. A name outside this list is refused, so a template can
 * never ask for a picture that does not exist.
 */
export const ICON_GROUPS = {
  health: ['droplet', 'heart-pulse', 'heart', 'activity', 'leaf', 'shield'],
  festival: ['sparkles', 'flame', 'music', 'mic', 'sun', 'gift'],
  sports: ['trophy', 'medal', 'award', 'flag', 'rocket'],
  education: ['graduation-cap', 'book-open', 'lightbulb', 'brain'],
  corporate: ['briefcase', 'globe', 'mail', 'phone'],
  awareness: ['megaphone', 'bell'],
  meeting: ['users', 'calendar', 'clock'],
  notice: ['map-pin', 'star', 'moon'],
  celebration: ['award', 'trophy', 'medal', 'sparkles', 'flag'],
  general: ['star', 'sparkles', 'heart', 'flag'],
  social: ['facebook', 'instagram', 'x', 'twitter', 'linkedin', 'youtube', 'whatsapp'],
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

/**
 * What the words of the event mean.
 *
 * Read in order, so the first group whose words appear decides the mark: an awards night is a
 * celebration of recognition and gets a trophy, not the parcel a gift fair gets. A word list
 * is matched whole (`\bword\b` with an optional s/es ending), so "run" never matches "brunch".
 * `gift` appears under gift alone on purpose - no other group may draw it.
 */
export const ICON_KEYWORDS = [
  { icon: 'gift', words: ['gift', 'gifting', 'present'] },
  { icon: 'trophy', words: ['award', 'awards', 'honour', 'honor', 'honours', 'honors', 'recognition', 'reward', 'winners', 'champions', 'gala'] },
  { icon: 'droplet', words: ['blood', 'donation', 'donor', 'donate', 'plasma', 'vaccination'] },
  { icon: 'heart-pulse', words: ['health', 'medical', 'clinic', 'checkup', 'check-up', 'hospital', 'patient', 'wellness', 'fitness'] },
  { icon: 'leaf', words: ['tree', 'trees', 'plantation', 'plant', 'plants', 'nursery', 'garden', 'gardening', 'environment', 'earth', 'forest', 'ecology', 'cleanliness', 'sustainability'] },
  { icon: 'trophy', words: ['sport', 'sports', 'tournament', 'marathon', 'match', 'league', 'championship', 'cricket', 'football', 'olympiad', 'gymkhana', 'run', 'running', 'race', 'cycling', 'yoga'] },
  { icon: 'flame', words: ['diwali', 'deepavali', 'holi', 'eid', 'christmas', 'carnival', 'festival', 'fireworks', 'lantern', 'lights'] },
  { icon: 'graduation-cap', words: ['education', 'graduation', 'convocation', 'scholarship', 'seminar', 'webinar', 'workshop', 'training', 'students', 'studentship', 'school', 'college', 'university', 'academic', 'lecture', 'class', 'tuition', 'library'] },
  { icon: 'users', words: ['meeting', 'meet', 'conference', 'summit', 'townhall', 'town hall', 'team', 'session', 'networking', 'get-together', 'gathering', 'community'] },
  { icon: 'megaphone', words: ['awareness', 'campaign', 'protest', 'safety', 'road safety', 'vigil'] },
  { icon: 'bell', words: ['notice', 'announcement', 'reminder', 'alert', 'circular', 'invitation', 'invite'] },
  { icon: 'briefcase', words: ['business', 'corporate', 'company', 'startup', 'start-up', 'expo', 'trade fair', 'career', 'job', 'recruitment', 'investor'] },
  { icon: 'map-pin', words: ['venue', 'location', 'inauguration', 'opening', 'travel', 'tour', 'trek', 'excursion'] },
  { icon: 'moon', words: ['night', 'midnight', 'stargazing'] },
  { icon: 'sun', words: ['day', 'morning', 'summer', 'harvest'] },
];

/** The group of marks a keyword set belongs to, so a choice can still fall back to one. */
const ICON_BY_WORD = ICON_KEYWORDS.map((entry) => ({
  ...entry,
  patterns: entry.words.map((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-\\s]');
    return new RegExp(`(^|[^a-z0-9])(${escaped})(s|es)?([^a-z0-9]|$)`, 'i');
  }),
}));

/**
 * The mark that suits the words of the event.
 *
 * `category` is only the fallback: the words always win, because "awards night" is a recognition
 * event even when it was filed under celebration, and a parcel is never drawn unless asked for.
 */
export function iconForWords(words, category = '') {
  const text = (typeof words === 'string' ? words : '').toLowerCase();
  if (text) {
    for (const entry of ICON_BY_WORD) {
      if (!ICON_NAMES.includes(entry.icon)) continue;
      if (entry.patterns.some((pattern) => pattern.test(text))) return entry.icon;
    }
  }
  return iconForCategory(category);
}

/** The only typefaces a template may ask for (the same list the brand kit offers).
 * The last six carry Tamil shapes; /shared/textScripts.js keeps that list in step with this one. */
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
  'Noto Sans Tamil',
  'Noto Serif Tamil',
  'Hind Madurai',
  'Mukta Malar',
  'Catamaran',
  'Baloo Thambi 2',
];

export const ELEMENT_WEIGHTS = [400, 500, 600, 700, 800];

/** Every weight a family is asked for by name when the family itself offers none. */
const FULL_WEIGHT_RANGE = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * The weights each offered family really publishes, read from the font service.
 *
 * Asking a family for a weight it does not have loses that family from the request in silence,
 * and the words fall back to a plain system face - in the preview and in the exported file.
 * The Tamil families are the narrowest: Hind Madurai stops at 700, Mukta Malar at 800, and
 * Baloo Thambi 2 starts at 400, while a design sets its title at 800 or 900.
 */
export const FONT_WEIGHTS = {
  Outfit: FULL_WEIGHT_RANGE,
  Inter: FULL_WEIGHT_RANGE,
  Montserrat: FULL_WEIGHT_RANGE,
  Poppins: FULL_WEIGHT_RANGE,
  'Playfair Display': [400, 500, 600, 700, 800, 900],
  'Plus Jakarta Sans': [200, 300, 400, 500, 600, 700, 800],
  Cinzel: [400, 500, 600, 700, 800, 900],
  Roboto: FULL_WEIGHT_RANGE,
  'Open Sans': [300, 400, 500, 600, 700, 800],
  Lato: [100, 300, 400, 700, 900],
  'DM Sans': FULL_WEIGHT_RANGE,
  Nunito: [200, 300, 400, 500, 600, 700, 800, 900],
  'Noto Sans Tamil': FULL_WEIGHT_RANGE,
  'Noto Serif Tamil': FULL_WEIGHT_RANGE,
  'Hind Madurai': [300, 400, 500, 600, 700],
  'Mukta Malar': [200, 300, 400, 500, 600, 700, 800],
  Catamaran: FULL_WEIGHT_RANGE,
  'Baloo Thambi 2': [400, 500, 600, 700, 800],
};

/**
 * The weights to ask the font service for: only those a family publishes, each one the nearest
 * it has to the weight the design wanted. A family that is not listed keeps its weights untouched.
 */
export function weightsFor(family, weights = []) {
  const available = FONT_WEIGHTS[String(family || '').trim()];
  const wanted = (Array.isArray(weights) ? weights : [weights])
    .map((weight) => Number(weight))
    .filter((weight) => Number.isFinite(weight));
  if (!available || wanted.length === 0) return [...new Set(wanted)].sort((a, b) => a - b);
  const nearest = wanted.map((weight) =>
    available.reduce((best, each) => (Math.abs(each - weight) < Math.abs(best - weight) ? each : best), available[0])
  );
  return [...new Set(nearest)].sort((a, b) => a - b);
}

/** Brand tokens that can be used in place of explicit colors or fonts. */
export const BRAND_STYLE_TOKENS = [
  'brand:primary',
  'brand:secondary',
  'brand:accent',
  'brand:text',
  'brand:background',
  'brand:heading',
  'brand:body',
];

export const BRAND_COLOR_TOKENS = BRAND_STYLE_TOKENS;
export const BRAND_FONT_TOKENS = BRAND_STYLE_TOKENS;

export const BRAND_TEXT_TOKENS = [
  '{{brand.orgName}}',
  '{{brand.website}}',
  '{{brand.phone}}',
  '{{brand.email}}',
  '{{brand.address}}',
  '{{brand.legalText}}',
];

export const SECTION_KINDS = ['text', 'image', 'shape', 'icon'];
export const SECTION_LIMITS = {
  header: { minHeight: 60, maxHeight: 260, maxItems: 15 },
  footer: { minHeight: 60, maxHeight: 260, maxItems: 15 },
  content: { maxItems: 150 },
};

export const PAGE_MODES = ['brand', 'custom'];
export const CONTENT_BACKGROUND_TYPES = ['color', 'gradient', 'image', 'pattern'];
export const BACKGROUND_POSITIONS = ['top', 'center', 'bottom', 'left', 'right'];
export const BACKGROUND_PATTERNS = ['none', 'dots', 'lines', 'grid'];
export const CONTENT_DECORATIONS = ['none', 'band', 'circle', 'corners'];

export const DEFAULT_PAGE_BACKGROUND = {
  type: 'color',
  color: '#ffffff',
  gradientFrom: '#059669',
  gradientTo: '#0f172a',
  gradientAngle: 135,
  imageUrl: '',
  overlayColor: '#0b0f17',
  overlayOpacity: 0.4,
  position: 'center',
  pattern: 'none',
  fit: 'cover',
};

export const DEFAULT_PAGE_DECORATION = {
  decoration: 'none',
  decorationColor: '#059669',
};

export const DEFAULT_PAGE_WATERMARK = {
  show: false,
  opacity: 0.08,
};

export const DEFAULT_PAGE_INFO_CARD = {
  background: '#f8fafc',
  border: '#e2e8f0',
  radius: 16,
  iconColor: '#059669',
};

export function defaultPage() {
  return {
    background: { mode: 'brand' },
    decoration: { mode: 'brand' },
    watermark: { mode: 'brand' },
    infoCard: { mode: 'brand' },
  };
}

export function isBrandColorToken(value) {
  return typeof value === 'string' && BRAND_COLOR_TOKENS.includes(value.trim());
}

export function isBrandFontToken(value) {
  return typeof value === 'string' && BRAND_FONT_TOKENS.includes(value.trim());
}

export function isStyleColor(value) {
  return isHexColor(value) || isBrandColorToken(value);
}

export function isStyleFont(value) {
  return (typeof value === 'string' && ELEMENT_FONTS.includes(value.trim())) || isBrandFontToken(value);
}

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
  maxText: 40,
  maxImage: 24,
  key: { min: 2, max: 24 },
  labelChars: 30,
  hintChars: 80,
  sampleChars: 80,
  /** How long one filled-in line of words may be. */
  maxLength: { min: 10, max: 200, default: 80 },
  /** Everything a poster fills in, kept small enough to store and print. */
  valuesTotalBytes: 4096,
};

export const VARIABLE_KEY_PATTERN = /^[a-z0-9_]{2,24}$/;

/** Hosts a poster picture may come from: this app's own storage, or the image library. */
export const POSTER_IMAGE_HOSTS = ['res.cloudinary.com', 'images.pexels.com', 'images.unsplash.com'];

export const CARD_LIST_LIMITS = {
  maxLists: 12,
  columns: { min: 1, max: 5, default: 1 },
  minCount: { min: 0, max: 1, default: 0 },
  maxCount: { min: 1, max: 12, default: 12 },
  maxFields: 6,
  fieldKey: { min: 2, max: 24 },
  fieldLabelChars: 30,
};

export const ELEMENT_LIMITS = {
  maxItems: 150,
  maxText: 150,
  maxImage: 40,
  maxShape: 150,
  maxCardList: 12,
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

/**
 * A rule is a drawn line in a design: the thin divider between two facts in a pill, a hairline
 * under a heading. It is a filled shape, so the browser paints exactly its own rectangle, but it
 * is a mark rather than a box of words, so it may be narrower than an item that holds text.
 * The short side stays within this range and the item is at least three times longer than thick.
 */
export const RULE_THICKNESS = { min: 3, max: 8, ratio: 3 };

/** A whole template document (items + history) must stay near this size. */
export const TEMPLATE_DOC_MAX_BYTES = 400 * 1024;

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
  'sample',
  'sampleImage',
  'defaultImage',
  'rotation',
  'mask',
  'groupId',
  'hidden',
  'src',
  'aspectRatio',
  'columns',
  'gapX',
  'gapY',
  'minCount',
  'maxCount',
  'align',
  'card',
  'fieldKey',
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

export function isGradient(value) {
  if (typeof value !== 'string') return false;
  const t = value.trim().toLowerCase();
  return (t.startsWith('linear-gradient(') || t.startsWith('radial-gradient(')) && t.endsWith(')');
}

export function normalizeStyleColor(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (isBrandColorToken(text)) return text;
  if (isGradient(text)) return text;
  return normalizeHexColor(text, fallback);
}

export function resolveColorToken(token, brandKit) {
  if (typeof token !== 'string') return token;
  const key = token.trim();
  if (!BRAND_COLOR_TOKENS.includes(key)) return token;
  const kit = toPlain(brandKit) || {};
  const colors = kit.colors || {};
  const content = kit.content || {};
  switch (key) {
    case 'brand:primary':
      return normalizeHexColor(colors.primary, '#059669');
    case 'brand:secondary':
      return normalizeHexColor(colors.secondary, '#0f172a');
    case 'brand:accent':
      return normalizeHexColor(colors.accent || content.accentColor, '#10b981');
    case 'brand:text':
      return normalizeHexColor(colors.text, '#ffffff');
    case 'brand:background':
      return normalizeHexColor(colors.background, '#0b0f17');
    case 'brand:heading':
      return normalizeHexColor(content.headingColor || colors.primary, '#0f172a');
    case 'brand:body':
      return normalizeHexColor(content.bodyColor || colors.text, '#334155');
    default:
      return token;
  }
}

export function resolveFontToken(token, brandKit) {
  if (typeof token !== 'string') return token;
  const key = token.trim();
  if (!BRAND_FONT_TOKENS.includes(key)) return token;
  const kit = toPlain(brandKit) || {};
  const fonts = kit.fonts || {};
  const content = kit.content || {};
  switch (key) {
    case 'brand:heading':
    case 'brand:primary':
      return content.headingFont || fonts.heading || 'Outfit';
    case 'brand:body':
    case 'brand:secondary':
    case 'brand:text':
    case 'brand:accent':
    case 'brand:background':
      return content.bodyFont || fonts.body || 'Inter';
    default:
      return token;
  }
}

export function resolveBrandText(text, brandKit) {
  if (typeof text !== 'string' || !text.includes('{{')) return text || '';
  const kit = toPlain(brandKit) || {};
  const footer = kit.footer || {};
  const replacements = {
    'brand.orgName': kit.orgName || '',
    'brand.website': footer.website || kit.website || '',
    'brand.phone': footer.phone || kit.phone || '',
    'brand.email': footer.email || kit.email || '',
    'brand.address': footer.address || kit.address || '',
    'brand.legalText': footer.legalText || kit.legalText || '',
  };
  return text.replace(/\{\{\s*(brand\.(?:orgName|website|phone|email|address|legalText))\s*\}\}/g, (_, key) => {
    return replacements[key] ?? '';
  });
}

export function rotatedBoundingBox(rect, rotation = 0) {
  const rot = toNumber(rotation, 0);
  if (!rot || rot % 360 === 0) {
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newW = rect.w * cos + rect.h * sin;
  const newH = rect.w * sin + rect.h * cos;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return {
    x: cx - newW / 2,
    y: cy - newH / 2,
    w: newW,
    h: newH,
  };
}

export function resolveStyleTokens(styleOrElement, brandKit) {
  if (!styleOrElement || typeof styleOrElement !== 'object') return styleOrElement;
  const raw = toPlain(styleOrElement);
  const out = { ...raw };
  if (out.color && typeof out.color === 'string' && isBrandColorToken(out.color)) {
    out.color = resolveColorToken(out.color, brandKit);
  }
  if (out.fill && typeof out.fill === 'string' && isBrandColorToken(out.fill)) {
    out.fill = resolveColorToken(out.fill, brandKit);
  }
  if (out.stroke && typeof out.stroke === 'string' && isBrandColorToken(out.stroke)) {
    out.stroke = resolveColorToken(out.stroke, brandKit);
  }
  if (out.fontFamily && typeof out.fontFamily === 'string' && isBrandFontToken(out.fontFamily)) {
    out.fontFamily = resolveFontToken(out.fontFamily, brandKit);
  }
  const kit = toPlain(brandKit) || {};
  const logoUrl =
    kit.logos?.find((l) => l.isPrimary)?.url ||
    kit.logos?.[0]?.url ||
    kit.logoUrl ||
    kit.logo ||
    kit.header?.logoUrl ||
    '';
  if (out.imageUrl === 'brand:logo') {
    out.imageUrl = logoUrl;
  }
  if (out.src === 'brand:logo') {
    out.src = logoUrl;
  }
  if (typeof out.text === 'string' && out.text.includes('{{')) {
    out.text = resolveBrandText(out.text, brandKit);
  }
  if (out.style && typeof out.style === 'object') {
    out.style = resolveStyleTokens(out.style, brandKit);
  }
  if (out.shape && typeof out.shape === 'object') {
    out.shape = resolveStyleTokens(out.shape, brandKit);
  }
  return out;
}

export function effectivePage(brandKit, template) {
  const kit = toPlain(brandKit) || {};
  const tpl = toPlain(template) || {};
  const content = kit.content || {};
  const page = tpl.page || {};

  const customBg = page.background?.mode === 'custom';
  const customDec = page.decoration?.mode === 'custom';
  const customWatermark = page.watermark?.mode === 'custom';
  const customCard = page.infoCard?.mode === 'custom';

  const rawBg = customBg ? page.background : (content.background || {});
  const background = {
    ...DEFAULT_PAGE_BACKGROUND,
    ...(isPlainObject(rawBg) ? rawBg : {}),
  };
  if (isBrandColorToken(background.color)) background.color = resolveColorToken(background.color, kit);
  if (isBrandColorToken(background.gradientFrom)) background.gradientFrom = resolveColorToken(background.gradientFrom, kit);
  if (isBrandColorToken(background.gradientTo)) background.gradientTo = resolveColorToken(background.gradientTo, kit);
  if (isBrandColorToken(background.overlayColor)) background.overlayColor = resolveColorToken(background.overlayColor, kit);

  const decRaw = customDec
    ? (page.decoration.decoration || page.decoration.type || 'none')
    : (content.decoration || 'none');
  const decoration = CONTENT_DECORATIONS.includes(decRaw) ? decRaw : 'none';

  let decorationColor = customDec
    ? (page.decoration.decorationColor || '#059669')
    : (content.decorationColor || '#059669');
  if (isBrandColorToken(decorationColor)) decorationColor = resolveColorToken(decorationColor, kit);

  const watermark = customWatermark
    ? {
        show: Boolean(page.watermark.show),
        opacity: page.watermark.opacity !== undefined ? Number(page.watermark.opacity) : 0.08,
      }
    : {
        show: Boolean(content.watermark?.show),
        opacity: content.watermark?.opacity !== undefined ? Number(content.watermark.opacity) : 0.08,
      };

  const rawCard = customCard ? page.infoCard : (content.infoCard || {});
  const infoCard = {
    ...DEFAULT_PAGE_INFO_CARD,
    ...(isPlainObject(rawCard) ? rawCard : {}),
  };
  if (isBrandColorToken(infoCard.background)) infoCard.background = resolveColorToken(infoCard.background, kit);
  if (isBrandColorToken(infoCard.border)) infoCard.border = resolveColorToken(infoCard.border, kit);
  if (isBrandColorToken(infoCard.iconColor)) infoCard.iconColor = resolveColorToken(infoCard.iconColor, kit);

  return {
    background,
    decoration,
    decorationColor,
    watermark,
    infoCard,
  };
}

export function normalizePage(page) {
  if (!page || typeof page !== 'object') return undefined;
  const raw = toPlain(page);
  const out = {};

  if (raw.background) {
    const bg = isPlainObject(raw.background) ? raw.background : {};
    const mode = bg.mode === 'custom' ? 'custom' : 'brand';
    out.background = {
      mode,
      type: CONTENT_BACKGROUND_TYPES.includes(bg.type) ? bg.type : 'color',
      color: normalizeStyleColor(bg.color, '#ffffff'),
      gradientFrom: normalizeStyleColor(bg.gradientFrom, '#059669'),
      gradientTo: normalizeStyleColor(bg.gradientTo, '#0f172a'),
      gradientAngle: clamp(toInt(bg.gradientAngle, 135), 0, 360),
      imageUrl: typeof bg.imageUrl === 'string' ? bg.imageUrl.trim().slice(0, 500) : '',
      overlayColor: normalizeStyleColor(bg.overlayColor, '#0b0f17'),
      overlayOpacity: clamp(toNumber(bg.overlayOpacity, 0.4), 0, 1),
      fit: IMAGE_FITS.includes(bg.fit) ? bg.fit : 'cover',
      position: BACKGROUND_POSITIONS.includes(bg.position) ? bg.position : 'center',
      pattern: BACKGROUND_PATTERNS.includes(bg.pattern) ? bg.pattern : 'none',
    };
  }

  if (raw.decoration) {
    const dec = isPlainObject(raw.decoration) ? raw.decoration : {};
    const mode = dec.mode === 'custom' ? 'custom' : 'brand';
    const decType = dec.decoration || dec.type || 'none';
    out.decoration = {
      mode,
      decoration: CONTENT_DECORATIONS.includes(decType) ? decType : 'none',
      decorationColor: normalizeStyleColor(dec.decorationColor, '#059669'),
    };
  }

  if (raw.watermark) {
    const wm = isPlainObject(raw.watermark) ? raw.watermark : {};
    const mode = wm.mode === 'custom' ? 'custom' : 'brand';
    out.watermark = {
      mode,
      show: Boolean(wm.show),
      opacity: clamp(toNumber(wm.opacity, 0.08), 0, 0.3),
    };
  }

  if (raw.infoCard) {
    const card = isPlainObject(raw.infoCard) ? raw.infoCard : {};
    const mode = card.mode === 'custom' ? 'custom' : 'brand';
    out.infoCard = {
      mode,
      background: normalizeStyleColor(card.background, '#f8fafc'),
      border: normalizeStyleColor(card.border, '#e2e8f0'),
      radius: clamp(toInt(card.radius, 16), 0, 32),
      iconColor: normalizeStyleColor(card.iconColor, '#059669'),
    };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function templateSizeOf(template) {
  const size = toPlain(template?.size);
  return {
    width: clamp(toInt(size?.width, TEMPLATE_SIZE_FALLBACK.width), 1, 4000),
    height: clamp(toInt(size?.height, TEMPLATE_SIZE_FALLBACK.height), 1, 6000),
  };
}

/**
 * The two band heights a poster of this size actually gets: both as asked for, unless
 * together they would leave no room to design in, and then shrunk in proportion.
 */
function bandPairHeights(size, header, footer, ranges = BAND_HEIGHTS) {
  let top = clamp(toInt(header, ranges.header.default), 0, ranges.header.max);
  let bottom = clamp(toInt(footer, ranges.footer.default), 0, ranges.footer.max);

  const room = Math.max(MIN_CONTENT_STRIP, size.height - MIN_CONTENT_STRIP);
  if (top + bottom > room) {
    const scale = top + bottom > 0 ? room / (top + bottom) : 0;
    top = Math.floor(top * scale);
    bottom = Math.floor(bottom * scale);
  }
  top = Math.min(top, size.height);
  bottom = Math.min(bottom, size.height - top);

  return { header: top, footer: bottom };
}

/**
 * The rectangle items are allowed to live in: the poster minus the brand header band at
 * the top and the brand footer band at the bottom. Both bands shrink proportionally when
 * together they would leave no room to design in.
 */
export function contentArea(brandKit, template) {
  const kit = toPlain(brandKit) || {};
  const size = templateSizeOf(template);
  const bands = bandPairHeights(size, kit?.header?.height, kit?.footer?.height);

  return {
    x: 0,
    y: bands.header,
    w: size.width,
    h: Math.max(0, size.height - bands.header - bands.footer),
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

/**
 * True for a drawn rule: a filled shape that is long and thin, in either direction.
 *
 * Only a shape can be a rule - an item that carries words, a photo or a mark always needs the
 * full room, because its own text or picture would be cut off at a few pixels wide.
 */
export function isThinRule(element) {
  const raw = toPlain(element) || {};
  if (raw.kind !== 'shape') return false;
  const shape = toPlain(raw.shape) || {};
  if (!shape.fill) return false;
  const w = toInt(raw.w, 0);
  const h = toInt(raw.h, 0);
  const { min, max, ratio } = RULE_THICKNESS;
  const thin = (thick, long) => thick >= min && thick <= max && long >= thick * ratio;
  return thin(w, h) || thin(h, w);
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
    fontFamily: isStyleFont(filled.fontFamily)
      ? (typeof filled.fontFamily === 'string' ? filled.fontFamily.trim() : filled.fontFamily)
      : ELEMENT_STYLE_DEFAULTS.fontFamily,
    size,
    minSize,
    weight,
    color: normalizeStyleColor(filled.color, ELEMENT_STYLE_DEFAULTS.color),
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
    fill: normalizeStyleColor(filled.fill, ''),
    stroke: normalizeStyleColor(filled.stroke, ''),
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

export function slotKeyFromLabel(label, existingKeys = [], fallbackPrefix = 'slot') {
  const existing = existingKeys instanceof Set ? existingKeys : new Set(Array.isArray(existingKeys) ? existingKeys : []);
  let base = typeof label === 'string'
    ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    : '';
  if (!base) {
    base = fallbackPrefix.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'slot';
  }
  if (base.length < VARIABLE_LIMITS.key.min) {
    base = `${base}_slot`.slice(0, VARIABLE_LIMITS.key.max);
  } else if (base.length > VARIABLE_LIMITS.key.max) {
    base = base.slice(0, VARIABLE_LIMITS.key.max).replace(/_+$/, '');
  }
  if (base.length < VARIABLE_LIMITS.key.min) {
    base = 'slot_1';
  }
  let candidate = base;
  let counter = 2;
  while (existing.has(candidate)) {
    const suffix = `_${counter}`;
    const trimmedBase = base.slice(0, Math.max(VARIABLE_LIMITS.key.min, VARIABLE_LIMITS.key.max - suffix.length)).replace(/_+$/, '');
    candidate = `${trimmedBase}${suffix}`;
    counter += 1;
  }
  return candidate;
}

export function duplicateSlotKey(key, existingKeys = []) {
  return slotKeyFromLabel(key, existingKeys, 'slot');
}

function derivedKey(kind, index, label) {
  if (label && typeof label === 'string' && label.trim()) {
    return slotKeyFromLabel(label, [], kind === 'image' ? 'photo' : 'words');
  }
  return `${kind === 'image' ? 'photo' : 'words'}_slot_${index + 1}`.slice(0, VARIABLE_LIMITS.key.max);
}

/**
 * The fill-in settings of one item, or null when the item is fixed. Only a text box or a
 * picture can become a slot - the poster's own headline, date and photo are filled by the
 * rules that already exist for them.
 */
function normalizeVariable(raw, index) {
  if (!raw.variable) return null;
  const key = normalizeVariableKey(raw.key) || derivedKey(raw.kind, index, raw.label);
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
    if (typeof raw.sample === 'string' && raw.sample.trim()) {
      slot.sample = plainText(raw.sample.trim(), VARIABLE_LIMITS.sampleChars);
    }
  }
  if (raw.kind === 'image') {
    if (typeof raw.aspectRatio === 'string' && raw.aspectRatio.trim()) {
      slot.aspectRatio = raw.aspectRatio.trim().slice(0, 20);
    }
    const maskVal = typeof raw.mask === 'string' ? raw.mask.trim().toLowerCase() : '';
    if (maskVal && IMAGE_MASKS.includes(maskVal)) {
      slot.mask = maskVal;
    }
    if (typeof raw.sampleImage === 'string' && raw.sampleImage.trim()) {
      slot.sampleImage = raw.sampleImage.trim().slice(0, 600);
    }
    /* Off unless an administrator ticks it. Ticked means the picture left in this space becomes
       the starting picture of every new poster, as a real answer a person can remove. */
    if (raw.defaultImage === true) slot.defaultImage = true;
  }
  return slot;
}

/** Fills in everything an element may be missing and drops keys it should not carry. */
export function normalizeElement(element, index = 0, context = {}) {
  const raw = toPlain(element) || {};
  const kind = ELEMENT_KINDS.includes(raw.kind) ? raw.kind : 'text';
  const field = kind === 'field' && ELEMENT_FIELDS.includes(raw.field) ? raw.field : null;
  const isSectionBand = context.section === 'header' || context.section === 'footer';
  const out = {
    id: plainText(raw.id, ELEMENT_LIMITS.idChars) || `item-${index + 1}`,
    kind,
    x: toInt(raw.x, 0),
    y: toInt(raw.y, 0),
    w: toInt(raw.w, ELEMENT_LIMITS.minWidth),
    h: toInt(raw.h, ELEMENT_LIMITS.minHeight),
    z: clamp(toInt(raw.z, index), ELEMENT_LIMITS.z.min, ELEMENT_LIMITS.z.max),
    locked: Boolean(raw.locked),
    rotation: clamp(toInt(raw.rotation, 0), -180, 180),
    style: normalizeStyle(raw.style),
  };
  if (typeof raw.groupId === 'string' && raw.groupId.trim()) {
    out.groupId = raw.groupId.trim().slice(0, 50);
  }
  if (raw.hidden) {
    out.hidden = true;
  }
  const rawMask = typeof raw.mask === 'string' ? raw.mask.trim().toLowerCase() : typeof raw.style?.mask === 'string' ? raw.style.mask.trim().toLowerCase() : '';
  if (rawMask && IMAGE_MASKS.includes(rawMask)) {
    out.mask = rawMask;
  }
  if (typeof raw.aspectRatio === 'string' && raw.aspectRatio.trim()) {
    out.aspectRatio = raw.aspectRatio.trim().slice(0, 20);
  }
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
    const rawUrl = typeof raw.imageUrl === 'string'
      ? raw.imageUrl.trim()
      : typeof raw.src === 'string'
        ? raw.src.trim()
        : typeof raw.url === 'string'
          ? raw.url.trim()
          : '';
    if (rawUrl === 'brand:logo') {
      out.imageUrl = 'brand:logo';
      out.src = 'brand:logo';
    } else if (/^data:image\//i.test(rawUrl) || /^blob:/i.test(rawUrl)) {
      out.imageUrl = rawUrl;
      out.src = rawUrl;
    } else {
      const url = rawUrl.slice(0, 600);
      out.imageUrl = /^https:\/\//i.test(url) ? url : '';
      if (raw.src || raw.url) out.src = out.imageUrl;
    }
  }
  if (out.kind === 'shape') out.shape = normalizeShape(raw.shape);
  if (typeof raw.fieldKey === 'string' && raw.fieldKey.trim()) {
    out.fieldKey = raw.fieldKey.trim().toLowerCase();
  }
  if (out.kind === 'cardlist') {
    out.key = normalizeVariableKey(raw.key) || derivedKey('cardlist', index, raw.label);
    out.label = plainText(raw.label, VARIABLE_LIMITS.labelChars) || `List ${index + 1}`;
    out.hint = plainText(raw.hint, VARIABLE_LIMITS.hintChars);
    out.columns = clamp(toInt(raw.columns, 1), 1, 5);
    out.gapX = Math.max(0, toInt(raw.gapX, 16));
    out.gapY = Math.max(0, toInt(raw.gapY, 16));
    out.minCount = clamp(toInt(raw.minCount, 0), 0, 1);
    out.maxCount = clamp(toInt(raw.maxCount, 12), 1, 12);
    out.align = ['left', 'center', 'right'].includes(raw.align) ? raw.align : 'left';
    if (raw.previewCount !== undefined) {
      out.previewCount = clamp(toInt(raw.previewCount, 3), 1, 12);
    }

    const rawCard = toPlain(raw.card) || {};
    const rawFields = Array.isArray(rawCard.fields) ? rawCard.fields.slice(0, 6) : [];
    const fields = rawFields.map((f, fIdx) => {
      const fType = f?.type === 'image' ? 'image' : 'text';
      const fKey = normalizeVariableKey(f?.key) || `field_${fIdx + 1}`;
      const fieldObj = {
        key: fKey,
        type: fType,
        label: plainText(f?.label, VARIABLE_LIMITS.labelChars) || fKey,
      };
      if (fType === 'text') {
        fieldObj.maxLength = clamp(
          toInt(f?.maxLength, VARIABLE_LIMITS.maxLength.default),
          VARIABLE_LIMITS.maxLength.min,
          VARIABLE_LIMITS.maxLength.max
        );
      }
      return fieldObj;
    });

    const cardW = Math.max(40, toInt(rawCard.w, 300));
    const cardH = Math.max(24, toInt(rawCard.h, 150));
    const cardArea = { x: 0, y: 0, w: cardW, h: cardH };
    const cardItems = Array.isArray(rawCard.items)
      ? rawCard.items.map((item, itemIdx) => {
          const norm = normalizeElement(item, itemIdx, { area: cardArea, inCard: true });
          if (typeof item?.fieldKey === 'string' && item.fieldKey.trim()) {
            norm.fieldKey = item.fieldKey.trim().toLowerCase();
          }
          return norm;
        })
      : [];

    out.card = {
      w: cardW,
      h: cardH,
      fields,
      items: cardItems,
    };
  }
  if (!isSectionBand) {
    const variable = normalizeVariable({ ...raw, kind: out.kind }, index);
    if (variable && (out.kind === 'text' || out.kind === 'image')) Object.assign(out, variable);
  }
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
  if (value === 'brand:logo') return { ok: true };
  if (value.startsWith('brand:')) {
    return { ok: false, reason: `"${value}" is not a brand picture token this app offers.` };
  }
  if (value.startsWith('data:')) {
    return { ok: false, reason: 'Photos cannot be uploaded as raw data. Upload it to your image library first.' };
  }
  if (!value.startsWith(tenantImagePrefix(cloudName))) {
    return { ok: false, reason: 'Photos must come from your own image library.' };
  }
  if (clientId) {
    const isClientFolder =
      value.includes(`/brand/${clientId}/`) ||
      value.includes(`/posters/${clientId}/`) ||
      value.includes(`/tenants/${clientId}/`);
    if (!isClientFolder) {
      return { ok: false, reason: 'That photo belongs to another organization or another folder.' };
    }
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
  if (element.kind === 'cardlist') return `card list “${element.label || element.key || 'untitled'}”`;
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
  const counts = { text: 0, image: 0, shape: 0, cardlist: 0 };
  const fieldCounts = {};
  const ids = new Set();
  const slotKeys = new Set();
  const slotLabels = new Set();
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

    if (element.kind === 'cardlist') {
      if (context.section === 'header' || context.section === 'footer') {
        problems.push(`A ${context.section} cannot contain a card list.`);
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

      if (sent.columns !== undefined && sent.columns !== null) {
        const cols = toInt(sent.columns, 1);
        if (cols < CARD_LIST_LIMITS.columns.min || cols > CARD_LIST_LIMITS.columns.max) {
          problems.push(`The ${label} columns must be between ${CARD_LIST_LIMITS.columns.min} and ${CARD_LIST_LIMITS.columns.max}.`);
        }
      }
      if (sent.minCount !== undefined && sent.minCount !== null) {
        const minC = toInt(sent.minCount, 0);
        if (minC < CARD_LIST_LIMITS.minCount.min || minC > CARD_LIST_LIMITS.minCount.max) {
          problems.push(`The ${label} minimum count must be between ${CARD_LIST_LIMITS.minCount.min} and ${CARD_LIST_LIMITS.minCount.max}.`);
        }
      }
      if (sent.maxCount !== undefined && sent.maxCount !== null) {
        const maxC = toInt(sent.maxCount, 12);
        if (maxC < CARD_LIST_LIMITS.maxCount.min || maxC > CARD_LIST_LIMITS.maxCount.max) {
          problems.push(`The ${label} maximum count must be between ${CARD_LIST_LIMITS.maxCount.min} and ${CARD_LIST_LIMITS.maxCount.max}.`);
        }
      }
      if (toInt(sent.minCount, 0) > toInt(sent.maxCount, 12)) {
        problems.push(`The ${label} minimum count cannot exceed maximum count.`);
      }

      const card = toPlain(sent.card);
      if (card) {
        const cardFields = Array.isArray(card.fields) ? card.fields : [];
        if (cardFields.length > CARD_LIST_LIMITS.maxFields) {
          problems.push(`The ${label} can have at most ${CARD_LIST_LIMITS.maxFields} fields in a card.`);
        }
        const cardFieldKeys = new Set();
        cardFields.forEach((field, fIdx) => {
          const fKey = typeof field?.key === 'string' ? field.key.trim().toLowerCase() : '';
          if (!fKey || !VARIABLE_KEY_PATTERN.test(fKey)) {
            problems.push(`Field ${fIdx + 1} in ${label} has an invalid name "${field?.key || ''}".`);
          } else if (cardFieldKeys.has(fKey)) {
            problems.push(`Two fields in ${label} share the name "${fKey}".`);
          } else {
            cardFieldKeys.add(fKey);
          }
          if (field?.type !== 'text' && field?.type !== 'image') {
            problems.push(`Field "${fKey}" in ${label} must be text or image.`);
          }
          if (field?.type === 'text' && field?.maxLength !== undefined) {
            const ml = toInt(field.maxLength);
            if (ml < VARIABLE_LIMITS.maxLength.min || ml > VARIABLE_LIMITS.maxLength.max) {
              problems.push(`Field "${fKey}" in ${label} can hold between ${VARIABLE_LIMITS.maxLength.min} and ${VARIABLE_LIMITS.maxLength.max} characters.`);
            }
          }
        });
      }
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

      const rawSlotLabel = typeof sent.label === 'string' ? sent.label.trim() : '';
      if (!rawSlotLabel) {
        problems.push('Every variable item needs a label.');
      } else if (rawSlotLabel.length > VARIABLE_LIMITS.labelChars) {
        problems.push(`The ${label} has a label longer than ${VARIABLE_LIMITS.labelChars} characters.`);
      } else if (isGenericLabel(rawSlotLabel)) {
        problems.push(`The label "${rawSlotLabel}" is a generic default. Give it a specific label.`);
      } else if (slotLabels.has(rawSlotLabel.toLowerCase())) {
        problems.push(`Two fill-ins share the label "${rawSlotLabel}". Give each one its own label.`);
      } else {
        slotLabels.add(rawSlotLabel.toLowerCase());
      }

      if (sent.hint !== undefined && typeof sent.hint !== 'string') {
        problems.push(`The ${label} has a hint that is not text.`);
      } else if (typeof sent.hint === 'string' && sent.hint.trim().length > VARIABLE_LIMITS.hintChars) {
        problems.push(`The ${label} has a hint longer than ${VARIABLE_LIMITS.hintChars} characters.`);
      }

      if (element.kind === 'text') {
        if (sent.sample !== undefined && typeof sent.sample !== 'string') {
          problems.push(`The ${label} sample must be text.`);
        } else if (typeof sent.sample === 'string' && sent.sample.trim().length > VARIABLE_LIMITS.sampleChars) {
          problems.push(`The ${label} sample cannot be longer than ${VARIABLE_LIMITS.sampleChars} characters.`);
        }
        if (sent.maxLength !== undefined) {
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

      if (element.kind === 'image' && sent.sampleImage) {
        const sampleCheck = checkElementImageUrl(sent.sampleImage, context);
        if (!sampleCheck.ok) problems.push(`The ${label} sample image: ${sampleCheck.reason}`);
      }
    }

    if (element.imageUrl) {
      const check = checkElementImageUrl(element.imageUrl, context);
      if (!check.ok) problems.push(`The ${label}: ${check.reason}`);
    }

    if (context.section === 'header' || context.section === 'footer') {
      if (element.kind === 'field' || !SECTION_KINDS.includes(sent.kind)) {
        problems.push(`A ${context.section} cannot contain a poster field.`);
      }
      if (sent.variable || sent.key || sent.label || sent.hint || sent.field) {
        problems.push(`A variable in the ${context.section} is not allowed.`);
      }
    }

    if (sent.rotation !== undefined && sent.rotation !== null) {
      if (!isNumber(sent.rotation) || toNumber(sent.rotation) < -180 || toNumber(sent.rotation) > 180) {
        problems.push(`The ${label} rotation must be between -180 and 180 degrees.`);
      }
    }

    const rawStyle = isPlainObject(toPlain(sent.style)) ? toPlain(sent.style) : null;
    if (sent.style !== undefined && !rawStyle) {
      problems.push(`The ${label} has look settings that are not a set of choices.`);
    }

    const maskVal = sent.mask !== undefined ? sent.mask : rawStyle?.mask;
    if (maskVal !== undefined && maskVal !== null && maskVal !== '') {
      if (typeof maskVal !== 'string' || !IMAGE_MASKS.includes(maskVal.trim().toLowerCase())) {
        problems.push(`"${maskVal}" is not an image mask this app offers.`);
      }
    }

    if (sent.groupId !== undefined && sent.groupId !== null && typeof sent.groupId !== 'string') {
      problems.push(`The ${label} group name must be text.`);
    }

    if (sent.hidden !== undefined && sent.hidden !== null && typeof sent.hidden !== 'boolean') {
      problems.push(`The ${label} hidden setting must be true or false.`);
    }

    if (typeof sent.text === 'string' && sent.text.includes('{{')) {
      const tokenMatches = sent.text.match(/\{\{[^}]*\}\}/g) || [];
      for (const tokenMatch of tokenMatches) {
        const cleanToken = tokenMatch.replace(/\s+/g, '');
        if (!BRAND_TEXT_TOKENS.includes(cleanToken)) {
          problems.push(`"${tokenMatch}" is not a brand text token this app offers.`);
        }
      }
    }
    const colours = [
      ['colour', rawStyle?.color],
      ['shape colour', toPlain(sent.shape)?.fill],
      ['outline colour', toPlain(sent.shape)?.stroke],
    ];
    for (const [name, value] of colours) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string' && value.startsWith('brand:')) {
          if (!isBrandColorToken(value)) {
            problems.push(
              `"${value}" is not a brand color token this app offers. Provide a hex value such as #1a2b3c or a known brand token.`
            );
          }
        } else if (name === 'shape colour' && isGradient(value)) {
          // CSS gradient permitted for shape fill
        } else if (!isHexColor(value)) {
          problems.push(`The ${label} has a ${name} that is not a hex value such as #1a2b3c.`);
        }
      }
    }
    if (rawStyle?.fontFamily !== undefined && rawStyle?.fontFamily !== null && rawStyle?.fontFamily !== '') {
      if (typeof rawStyle.fontFamily === 'string' && rawStyle.fontFamily.startsWith('brand:')) {
        if (!isBrandFontToken(rawStyle.fontFamily)) {
          problems.push(`"${rawStyle.fontFamily}" is not a brand font token this app offers.`);
        }
      } else if (!ELEMENT_FONTS.includes(rawStyle.fontFamily)) {
        problems.push(`"${rawStyle.fontFamily}" is not one of the fonts this app offers.`);
      }
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
    const bbox = rotatedBoundingBox(rect, element.rotation || 0);
    const rule = isThinRule(element);
    if (!rule && (rect.w < ELEMENT_LIMITS.minWidth || rect.h < ELEMENT_LIMITS.minHeight)) {
      problems.push(
        `The ${label} is too small. It must be at least ${ELEMENT_LIMITS.minWidth} × ${ELEMENT_LIMITS.minHeight}.`
      );
    }
    if (
      rule &&
      (element.w < RULE_THICKNESS.min ||
        element.h < RULE_THICKNESS.min ||
        (element.w > RULE_THICKNESS.max && element.h > RULE_THICKNESS.max))
    ) {
      problems.push(
        `The ${label} is a rule, so one side must be ${RULE_THICKNESS.min}-${RULE_THICKNESS.max} pixels thick.`
      );
    }
    if (knowsBounds) {
      const isInside =
        bbox.x >= area.x - 0.001 &&
        bbox.y >= area.y - 0.001 &&
        bbox.x + bbox.w <= area.x + area.w + 0.001 &&
        bbox.y + bbox.h <= area.y + area.h + 0.001;
      if (!isInside) {
        const sectionName = context.section || 'content';
        if (sectionName === 'header') {
          problems.push(`The ${label} must sit fully inside the header.`);
        } else if (sectionName === 'footer') {
          problems.push(`The ${label} must sit fully inside the footer.`);
        } else {
          problems.push(`The ${label} must sit fully inside the poster, clear of the header and footer.`);
        }
      }
    }
  }

  if (context.section !== 'header' && context.section !== 'footer') {
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
  }
  if (counts.text > ELEMENT_LIMITS.maxText) {
    problems.push(`A template can hold at most ${ELEMENT_LIMITS.maxText} text boxes.`);
  }
  const staticImages = counts.image - variableImages;
  if (staticImages > ELEMENT_LIMITS.maxImage) {
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
  if (counts.cardlist > CARD_LIST_LIMITS.maxLists) {
    problems.push(`A template can hold at most ${CARD_LIST_LIMITS.maxLists} card lists.`);
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
  if (template?.sections?.content?.elements && Array.isArray(template.sections.content.elements)) {
    return template.sections.content.elements;
  }
  const elements = toPlain(template?.elements);
  return Array.isArray(elements) ? elements : [];
}

/**
 * Which blanks a set of items offers: `texts` are written by the assistant and then
 * editable, `images` are replaced by the person making the poster.
 */
export function variableSlotsOf(elements) {
  const slots = { texts: [], images: [], cardLists: [] };
  normalizeElements(elements).forEach((element) => {
    if (element.section === 'header' || element.section === 'footer') return;
    if (element.kind === 'cardlist') {
      slots.cardLists.push({
        id: element.id,
        key: element.key,
        label: element.label || element.key,
        hint: element.hint || '',
        columns: element.columns,
        gapX: element.gapX,
        gapY: element.gapY,
        minCount: element.minCount,
        maxCount: element.maxCount,
        align: element.align,
        card: element.card,
      });
      return;
    }
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

export function cardListsOf(elements) {
  return variableSlotsOf(elements).cardLists;
}

/** Only what the assistant needs to know about each blank - kept short on purpose. */
export function aiSlotsOf(elements) {
  return variableSlotsOf(elements).texts
    .filter((slot) => {
      const label = (slot.label || '').trim();
      if (!label || isGenericLabel(label)) return false;
      const hint = (slot.hint || '').trim();
      if (!hint) return false;
      return true;
    })
    .map(({ key, label, hint, maxLength }) => ({
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
  if (value.startsWith('data:')) {
    return { ok: false, reason: 'Photos cannot be uploaded as raw data. Upload it to your image library first.' };
  }
  let parsed = null;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'That photo address is not a full web address.' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'A photo must come from a secure (https) web address.' };
  if (parsed.hostname === 'images.pexels.com' || parsed.hostname === 'images.unsplash.com') return { ok: true };
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
  const listsMap = new Map((slots.cardLists || []).map((slot) => [slot.key, slot]));
  const problems = [];
  const extras = {};
  const images = {};
  const lists = {};

  const rawExtras = toPlain(content?.extras);
  if (rawExtras !== undefined && rawExtras !== null) {
    if (!isPlainObject(rawExtras)) {
      problems.push('Words filled into a template must be given as a set of labelled values.');
    } else {
      for (const [key, value] of Object.entries(rawExtras)) {
        const slot = texts.get(key);
        if (!slot) {
          const validNames = Array.from(texts.values()).map((s) => s.label || s.key);
          const validList = validNames.length ? ` Valid blanks: ${validNames.join(', ')}.` : ' This poster offers no text blanks.';
          problems.push(`"${key}" is not a blank this poster offers.${validList}`);
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
          const validNames = Array.from(pictures.values()).map((s) => s.label || s.key);
          const validList = validNames.length ? ` Valid photos: ${validNames.join(', ')}.` : ' This poster offers no photo spaces.';
          problems.push(`"${key}" is not a photo this poster offers.${validList}`);
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

  const rawLists = toPlain(content?.lists);
  if (rawLists !== undefined && rawLists !== null) {
    if (!isPlainObject(rawLists)) {
      problems.push('Card lists filled into a template must be given as a set of labelled lists.');
    } else {
      for (const [key, value] of Object.entries(rawLists)) {
        const listSlot = listsMap.get(key);
        if (!listSlot) {
          const validNames = Array.from(listsMap.values()).map((s) => s.label || s.key);
          const validList = validNames.length ? ` Valid lists: ${validNames.join(', ')}.` : ' This poster offers no card lists.';
          problems.push(`"${key}" is not a list this poster offers.${validList}`);
          continue;
        }
        if (!Array.isArray(value)) {
          problems.push(`The list "${listSlot.label}" must be a list of items.`);
          continue;
        }
        const minCount = listSlot.minCount !== undefined ? listSlot.minCount : 0;
        const maxCount = listSlot.maxCount !== undefined ? listSlot.maxCount : 12;
        if (value.length < minCount) {
          problems.push(`The list "${listSlot.label}" must have at least ${minCount} item(s).`);
          continue;
        }
        if (value.length > maxCount) {
          problems.push(`The list "${listSlot.label}" can have at most ${maxCount} item(s).`);
          continue;
        }
        const fieldMap = new Map((listSlot.card?.fields || []).map((f) => [f.key, f]));
        const validCards = [];
        for (const item of value) {
          if (!isPlainObject(item)) {
            problems.push(`Each card in "${listSlot.label}" must be an object.`);
            continue;
          }
          const cleanCard = {};
          for (const [fKey, fVal] of Object.entries(item)) {
            const fieldDef = fieldMap.get(fKey);
            if (!fieldDef) {
              const validFields = Array.from(fieldMap.values()).map((f) => f.label || f.key);
              const validList = validFields.length ? ` Valid fields: ${validFields.join(', ')}.` : '';
              problems.push(`"${fKey}" is not a field in list "${listSlot.label}".${validList}`);
              continue;
            }
            if (fieldDef.type === 'image') {
              if (typeof fVal !== 'string') {
                problems.push(`The photo in field "${fieldDef.label || fKey}" of list "${listSlot.label}" must be a web address.`);
                continue;
              }
              const url = fVal.trim().slice(0, 600);
              const check = checkContentImageUrl(url, { cloudName, clientId });
              if (!check.ok) {
                problems.push(`The photo in field "${fieldDef.label || fKey}" of list "${listSlot.label}": ${check.reason}`);
                continue;
              }
              if (url) cleanCard[fKey] = url;
            } else {
              if (typeof fVal !== 'string') {
                problems.push(`Field "${fieldDef.label || fKey}" in list "${listSlot.label}" must be words.`);
                continue;
              }
              const maxL = fieldDef.maxLength || VARIABLE_LIMITS.maxLength.default;
              const textVal = plainText(fVal, VARIABLE_LIMITS.maxLength.max);
              if (textVal.length > maxL) {
                problems.push(`Field "${fieldDef.label || fKey}" in list "${listSlot.label}" cannot be longer than ${maxL} characters.`);
                continue;
              }
              if (textVal) cleanCard[fKey] = textVal;
            }
          }
          validCards.push(cleanCard);
        }
        lists[key] = validCards;
      }
    }
  }

  if (!problems.length && jsonBytes({ extras, images }) > VARIABLE_LIMITS.valuesTotalBytes) {
    problems.push('There is too much to fill in on one poster. Please shorten the words.');
  }
  if (!problems.length && jsonBytes(lists) > 32 * 1024) {
    problems.push('There is too much to fill in on one poster. Please shorten the card lists.');
  }

  return {
    extras: Object.keys(extras).length ? extras : undefined,
    images: Object.keys(images).length ? images : undefined,
    lists: Object.keys(lists).length ? lists : undefined,
    problems,
  };
}

export function normalizeSections(sections, brandKit = null, template = null) {
  const raw = toPlain(sections) || {};
  const kit = toPlain(brandKit) || {};
  const tpl = toPlain(template) || {};

  const rawHeader = isPlainObject(raw.header) ? raw.header : {};
  const rawFooter = isPlainObject(raw.footer) ? raw.footer : {};
  const rawContent = isPlainObject(raw.content) ? raw.content : {};

  const headerHeight = clamp(
    toInt(rawHeader.height, kit.header?.height ?? 80),
    60,
    260
  );
  const footerHeight = clamp(
    toInt(rawFooter.height, kit.footer?.height ?? 70),
    60,
    260
  );

  const headerElements = (Array.isArray(rawHeader.elements) ? rawHeader.elements : []).slice(0, 15).map((el, idx) => {
    const norm = normalizeElement(el, idx, { section: 'header' });
    norm.variable = false;
    delete norm.field;
    delete norm.key;
    delete norm.label;
    delete norm.hint;
    delete norm.maxLength;
    return norm;
  });

  const footerElements = (Array.isArray(rawFooter.elements) ? rawFooter.elements : []).slice(0, 15).map((el, idx) => {
    const norm = normalizeElement(el, idx, { section: 'footer' });
    norm.variable = false;
    delete norm.field;
    delete norm.key;
    delete norm.label;
    delete norm.hint;
    delete norm.maxLength;
    return norm;
  });

  const contentElements = normalizeElements(
    Array.isArray(rawContent.elements) ? rawContent.elements : (tpl.elements || [])
  );

  return {
    header: {
      mode: rawHeader.mode === 'custom' ? 'custom' : 'brand',
      height: headerHeight,
      background: rawHeader.background ? { ...rawHeader.background } : (kit.header?.background ? { ...kit.header.background } : { ...DEFAULT_PAGE_BACKGROUND }),
      elements: headerElements,
    },
    content: {
      page: rawContent.page ? normalizePage(rawContent.page) : (tpl.page ? normalizePage(tpl.page) : defaultPage()),
      elements: contentElements,
    },
    footer: {
      mode: rawFooter.mode === 'custom' ? 'custom' : 'brand',
      height: footerHeight,
      background: rawFooter.background ? { ...rawFooter.background } : (kit.footer?.background ? { ...kit.footer.background } : { ...DEFAULT_PAGE_BACKGROUND }),
      elements: footerElements,
    },
  };
}

/**
 * Migrates existing templates on load:
 * Renames generic ("Small line", "Heading", "Subheading", "Body", "Photo space"),
 * empty, or duplicated variable labels to "Text N" and "Photo N".
 * Returns { migrated: boolean, count: number }.
 */
export function migrateTemplateLabels(target) {
  let migrated = false;
  let count = 0;
  if (!target) return { migrated, count };

  let elements = [];
  if (Array.isArray(target)) {
    elements = target;
  } else if (Array.isArray(target?.elements)) {
    elements = target.elements;
  } else if (Array.isArray(target?.content?.elements)) {
    elements = target.content.elements;
  } else if (Array.isArray(target?.sections?.content?.elements)) {
    elements = target.sections.content.elements;
  }

  const usedTextNumbers = new Set();
  const usedPhotoNumbers = new Set();
  const seenLabels = new Set();

  for (const item of elements) {
    if (!item || !item.variable) continue;
    const raw = String(item.label || '').trim();
    if (raw && !isGenericLabel(raw)) {
      const textM = raw.match(/^Text\s+(\d+)$/i);
      if (textM) usedTextNumbers.add(parseInt(textM[1], 10));
      const photoM = raw.match(/^Photo\s+(\d+)$/i);
      if (photoM) usedPhotoNumbers.add(parseInt(photoM[1], 10));
    }
  }

  for (const item of elements) {
    if (!item || !item.variable) continue;
    const isImage = item.kind === 'image';
    const raw = String(item.label || '').trim();
    const needsMigration = !raw || isGenericLabel(raw) || seenLabels.has(raw.toLowerCase());

    if (needsMigration) {
      if (isImage) {
        let n = 1;
        while (usedPhotoNumbers.has(n)) n += 1;
        usedPhotoNumbers.add(n);
        item.label = `Photo ${n}`;
        item.key = normalizeVariableKey(item.label) || `photo_${n}`;
      } else {
        let n = 1;
        while (usedTextNumbers.has(n)) n += 1;
        usedTextNumbers.add(n);
        item.label = `Text ${n}`;
        item.key = normalizeVariableKey(item.label) || `text_${n}`;
      }
      migrated = true;
      count += 1;
    }
    seenLabels.add(String(item.label || '').toLowerCase());
  }

  return { migrated, count };
}

export function legacyToSections(template, brandKit = null) {
  const tpl = toPlain(template) || {};
  const kit = toPlain(brandKit) || {};
  if (tpl.sections && isPlainObject(tpl.sections)) {
    return normalizeSections(tpl.sections, kit, tpl);
  }
  const headerHeight = clamp(toInt(kit.header?.height, 80), 60, 260);
  const footerHeight = clamp(toInt(kit.footer?.height, 70), 60, 260);
  const elements = Array.isArray(tpl.elements) && tpl.elements.length > 0
    ? normalizeElements(tpl.elements)
    : legacyToElements(tpl, kit);

  return {
    header: {
      mode: 'brand',
      height: headerHeight,
      background: kit.header?.background ? { ...kit.header.background } : { ...DEFAULT_PAGE_BACKGROUND },
      elements: [],
    },
    content: {
      page: tpl.page ? normalizePage(tpl.page) : defaultPage(),
      elements,
    },
    footer: {
      mode: 'brand',
      height: footerHeight,
      background: kit.footer?.background ? { ...kit.footer.background } : { ...DEFAULT_PAGE_BACKGROUND },
      elements: [],
    },
  };
}

export function validateTemplateSections(sections, context = {}) {
  if (!sections || typeof sections !== 'object') {
    return ['A template needs sections.'];
  }
  const raw = toPlain(sections);
  const problems = [];
  const brandKit = toPlain(context.brandKit) || {};
  const template = toPlain(context.template) || {};
  const size = templateSizeOf(template);

  const header = isPlainObject(raw.header) ? raw.header : {};
  const footer = isPlainObject(raw.footer) ? raw.footer : {};
  const content = isPlainObject(raw.content) ? raw.content : {};

  if (header.mode !== undefined && !['brand', 'custom'].includes(header.mode)) {
    problems.push('Header mode must be brand or custom.');
  }
  const headerHeight = header.height !== undefined ? toInt(header.height, 80) : clamp(toInt(brandKit.header?.height, 80), 60, 260);
  if (header.height !== undefined && (headerHeight < 60 || headerHeight > 260)) {
    problems.push('Header height must be between 60 and 260.');
  }

  if (footer.mode !== undefined && !['brand', 'custom'].includes(footer.mode)) {
    problems.push('Footer mode must be brand or custom.');
  }
  const footerHeight = footer.height !== undefined ? toInt(footer.height, 70) : clamp(toInt(brandKit.footer?.height, 70), 60, 260);
  if (footer.height !== undefined && (footerHeight < 60 || footerHeight > 260)) {
    problems.push('Footer height must be between 60 and 260.');
  }

  const headerElements = Array.isArray(header.elements) ? header.elements : [];
  if (headerElements.length > 15) {
    problems.push('The header can hold at most 15 items.');
  }
  const headerArea = { x: 0, y: 0, w: size.width, h: headerHeight };
  const headerProblems = validateElements(headerElements, {
    ...context,
    section: 'header',
    area: headerArea,
  });
  problems.push(...headerProblems);

  const footerElements = Array.isArray(footer.elements) ? footer.elements : [];
  if (footerElements.length > 15) {
    problems.push('The footer can hold at most 15 items.');
  }
  const footerArea = { x: 0, y: Math.max(0, size.height - footerHeight), w: size.width, h: footerHeight };
  const footerProblems = validateElements(footerElements, {
    ...context,
    section: 'footer',
    area: footerArea,
  });
  problems.push(...footerProblems);

  const contentAreaBox = {
    x: 0,
    y: headerHeight,
    w: size.width,
    h: Math.max(0, size.height - headerHeight - footerHeight),
  };
  const contentElements = Array.isArray(content.elements) ? content.elements : [];
  if (contentElements.length > ELEMENT_LIMITS.maxItems) {
    problems.push(`A template can hold at most ${ELEMENT_LIMITS.maxItems} items.`);
  }
  const contentProblems = validateElements(contentElements, {
    ...context,
    section: 'content',
    area: contentAreaBox,
  });
  problems.push(...contentProblems);

  return [...new Set(problems)];
}

export function brandHeaderToElements(brandKit, options = {}) {
  const kit = toPlain(brandKit) || {};
  const header = kit.header || {};
  const height = clamp(toInt(header.height, 80), 60, 260);
  const width = clamp(toInt(options?.width || options?.size?.width, 1080), 600, 2400);
  const elements = [];

  const logoSize = clamp(toInt(header.logo?.size, 48), 40, Math.min(height - 16, 120));
  const logoY = Math.round((height - logoSize) / 2);
  elements.push({
    id: 'brand-header-logo',
    kind: 'image',
    src: 'brand:logo',
    imageUrl: 'brand:logo',
    x: 40,
    y: Math.max(0, logoY),
    w: logoSize,
    h: logoSize,
    locked: false,
    variable: false,
  });

  const nameX = 40 + logoSize + 16;
  const nameW = Math.max(100, Math.min(500, width - nameX - 40));
  const hasTagline = Boolean(header.tagline?.text || kit.tagline);
  const nameH = hasTagline ? Math.min(36, Math.floor(height * 0.45)) : Math.min(48, Math.floor(height * 0.7));
  const nameY = hasTagline ? Math.round((height - (nameH + 28)) / 2) : Math.round((height - nameH) / 2);

  elements.push({
    id: 'brand-header-name',
    kind: 'text',
    text: '{{brand.orgName}}',
    x: nameX,
    y: Math.max(0, nameY),
    w: nameW,
    h: Math.max(24, nameH),
    style: {
      color: 'brand:text',
      fontFamily: 'brand:heading',
      size: hasTagline ? 22 : 26,
      weight: 700,
    },
    locked: false,
    variable: false,
  });

  const taglineText = String(header.tagline?.text || kit.tagline || '').trim();
  const tagH = Math.max(24, Math.floor(height * 0.35));
  const tagY = nameY + nameH + 4;
  elements.push({
    id: 'brand-header-tagline',
    kind: 'text',
    text: taglineText || 'Empowering communities',
    x: nameX,
    y: Math.min(height - tagH, tagY),
    w: nameW,
    h: tagH,
    style: {
      color: 'brand:text',
      fontFamily: 'brand:body',
      size: 14,
      weight: 400,
    },
    locked: false,
    variable: false,
  });

  return elements;
}

export function brandFooterToElements(brandKit, options = {}) {
  const kit = toPlain(brandKit) || {};
  const footer = kit.footer || {};
  const height = clamp(toInt(footer.height, 70), 60, 260);
  const posterHeight = clamp(toInt(options?.height || options?.size?.height, 1350), 600, 3200);
  const width = clamp(toInt(options?.width || options?.size?.width, 1080), 600, 2400);
  const footerY = posterHeight - height;
  const elements = [];

  const contactParts = [];
  if (footer.website || kit.website) contactParts.push('{{brand.website}}');
  if (footer.phone || kit.phone) contactParts.push('{{brand.phone}}');
  if (footer.email || kit.email) contactParts.push('{{brand.email}}');
  if (contactParts.length === 0) contactParts.push('{{brand.website}}', '{{brand.phone}}');

  const contactText = contactParts.join('  •  ');
  const contactH = 28;
  const contactY = footerY + Math.round((height - contactH) / 2);
  const contactW = Math.max(200, Math.min(600, width - 300));

  elements.push({
    id: 'brand-footer-contacts',
    kind: 'text',
    text: contactText,
    x: 40,
    y: Math.max(footerY, contactY),
    w: contactW,
    h: contactH,
    style: {
      color: 'brand:text',
      fontFamily: 'brand:body',
      size: 14,
      weight: 500,
    },
    locked: false,
    variable: false,
  });

  const socialList = Array.isArray(footer.social)
    ? footer.social
    : Array.isArray(footer.socials)
      ? footer.socials.map((s) => (typeof s === 'string' ? { platform: s, url: '' } : s))
      : [];

  const iconW = 40;
  const iconH = Math.min(height - 16, 32);
  const iconSpacing = 8;
  const totalSocialWidth = socialList.length * (iconW + iconSpacing);
  let socialX = width - 40 - totalSocialWidth;
  if (socialX < contactW + 50) {
    socialX = contactW + 50;
  }

  socialList.slice(0, 5).forEach((soc, idx) => {
    const rawPlat = typeof soc === 'string' ? soc : soc?.platform;
    const plat = typeof rawPlat === 'string' ? rawPlat.toLowerCase().trim() : '';
    const iconName = normalizeIconName(plat) || 'globe';
    elements.push({
      id: `brand-footer-social-${idx + 1}`,
      kind: 'icon',
      name: iconName,
      x: Math.round(socialX + idx * (iconW + iconSpacing)),
      y: Math.max(footerY, footerY + Math.round((height - iconH) / 2)),
      w: iconW,
      h: Math.max(24, iconH),
      style: {
        color: 'brand:text',
      },
      locked: false,
      variable: false,
    });
  });

  return elements;
}

/* ------------------------------------------------------------------------- *
 * Brand bands
 *
 * The header and the footer belong to the Brand Kit, not to a design: every poster of that
 * client draws them, and the person making a poster cannot touch them. A band is now the same
 * shape a template section carries - a height, a background and items placed on it - with two
 * settings that never change: it is always locked and it is never filled in per poster.
 *
 * `mode` says how the band is drawn:
 *   "legacy"   the Brand Kit's own header / footer settings, exactly as they draw today
 *   "elements" the items an admin placed on the band
 *
 * A kit saved before this feature has no mode and no items, so it keeps drawing its settings
 * until someone saves the band in the editor.
 * ------------------------------------------------------------------------- */

/** How a brand band is drawn. */
export const BRAND_BAND_MODES = ['legacy', 'elements'];
export const BRAND_BAND_KINDS = ['header', 'footer'];

const BAND_LABEL = { header: 'Header', footer: 'Footer' };

/** The rectangle this band occupies on a poster of this size. */
export function brandBandRect(kind, size, height) {
  const range = BAND_HEIGHTS[kind];
  if (!range) return { x: 0, y: 0, w: 0, h: 0 };
  const poster = templateSizeOf({ size });
  const h = clamp(toInt(height, range.default), 0, range.max);
  return kind === 'footer'
    ? { x: 0, y: Math.max(0, poster.height - h), w: poster.width, h }
    : { x: 0, y: 0, w: poster.width, h };
}

/**
 * One band of a brand kit, read the same way whether it was sent by an editor or came out of
 * the database. Items always arrive locked and never as a fill-in; a poster field, a slot name
 * or a hint on one is dropped here rather than stored.
 */
export function normalizeBrandBand(section, kind, brandKit = null) {
  const range = BAND_HEIGHTS[kind];
  if (!range) return undefined;
  const kit = toPlain(brandKit) || {};
  const stored = isPlainObject(kit[kind]) ? toPlain(kit[kind]) : {};
  const raw = isPlainObject(section) ? toPlain(section) : stored;

  const height = clamp(toInt(raw.height ?? stored.height, range.default), range.min, range.max);
  const background = isPlainObject(raw.background)
    ? toPlain(raw.background)
    : isPlainObject(stored.background)
      ? toPlain(stored.background)
      : undefined;

  const elements = (Array.isArray(raw.elements) ? raw.elements : [])
    .slice(0, SECTION_LIMITS[kind].maxItems)
    .map((element, index) => {
      const item = normalizeElement(element, index, { section: kind });
      item.variable = false;
      delete item.field;
      delete item.key;
      delete item.label;
      delete item.hint;
      delete item.maxLength;
      return item;
    });

  return { mode: raw.mode === 'elements' ? 'elements' : 'legacy', height, background, elements };
}

/**
 * Everything wrong with a band as it arrived. The item rules are the template's own, so a band
 * is refused for the same reasons - and in the same words - as a template section is.
 */
export function brandBandProblems(section, kind, context = {}) {
  const range = BAND_HEIGHTS[kind];
  if (!range) return [`A brand kit has no ${kind} band.`];

  const raw = toPlain(section);
  if (raw === undefined || raw === null) return [];
  if (!isPlainObject(raw)) return [`The ${kind} band needs a set of settings.`];

  const problems = [];
  if (raw.mode !== undefined && !BRAND_BAND_MODES.includes(raw.mode)) {
    problems.push(`A ${kind} band is drawn either from the brand's own settings or from items placed on it.`);
  }
  if (raw.height !== undefined) {
    const height = toInt(raw.height, 0);
    if (!isNumber(raw.height) || height < range.min || height > range.max) {
      problems.push(`${BAND_LABEL[kind]} height must be between ${range.min} and ${range.max}.`);
    }
  }
  if (raw.elements !== undefined && !Array.isArray(raw.elements)) {
    problems.push(`The ${kind} band's items are not a list.`);
  }
  const elements = Array.isArray(raw.elements) ? raw.elements : [];
  if (elements.length > SECTION_LIMITS[kind].maxItems) {
    problems.push(`The ${kind} can hold at most ${SECTION_LIMITS[kind].maxItems} items.`);
  }
  if (raw.mode === 'elements' && elements.length === 0) {
    problems.push(`A ${kind} band drawn by items needs at least one item.`);
  }

  const kit = toPlain(context.brandKit) || {};
  const size = context.size || kit.defaultPosterSize;
  const height = clamp(toInt(raw.height ?? kit[kind]?.height, range.default), range.min, range.max);
  const elementContext = { ...context, section: kind };
  /* Where an item may sit depends on the size this organization's posters are made at. A caller
     that does not know it yet checks everything else and leaves that rule to the one who does. */
  if (size || Object.keys(kit).length > 0) {
    elementContext.area = brandBandRect(kind, size || TEMPLATE_SIZE_FALLBACK, height);
  }
  problems.push(...validateElements(elements, elementContext));

  return [...new Set(problems)];
}

/**
 * The band a brand kit starts with: its own settings turned into items, so the band editor
 * opens on something to move instead of an empty strip. It is stored as mode "legacy", which
 * means the kit keeps drawing its settings until an admin says otherwise.
 */
export function defaultBrandBand(brandKit, kind, options = {}) {
  const kit = toPlain(brandKit) || {};
  const band = normalizeBrandBand(undefined, kind, kit);
  if (!band) return undefined;
  const size = options.size || kit.defaultPosterSize || TEMPLATE_SIZE_FALLBACK;
  /* The converters lay their items out for the height the band really has, so a kit that
     stored an impossible height still gets items that fit inside the strip. */
  const source = { ...kit, [kind]: { ...kit[kind], height: band.height } };
  const elements =
    kind === 'footer'
      ? brandFooterToElements(source, { width: size.width, height: size.height })
      : brandHeaderToElements(source, { width: size.width, height: size.height });
  return normalizeBrandBand({ elements }, kind, kit);
}

export function defaultBrandBands(brandKit, options = {}) {
  return {
    header: defaultBrandBand(brandKit, 'header', options),
    footer: defaultBrandBand(brandKit, 'footer', options),
  };
}

/**
 * What the band editor opens on: the items a kit already stores, or the ones its settings
 * convert into when it has never been edited. Deriving them here keeps an old kit untouched -
 * nothing is written until an admin saves.
 */
export function brandBandForEditing(brandKit, kind, options = {}) {
  const kit = toPlain(brandKit) || {};
  const band = normalizeBrandBand(undefined, kind, kit);
  if (!band) return undefined;
  return band.elements.length > 0 ? band : defaultBrandBand(kit, kind, options);
}

/** A template's own band, or null while it takes the Brand Kit's. */
function templateCustomBand(template, kind) {
  const tpl = toPlain(template) || {};
  const fromSections = isPlainObject(tpl.sections) ? toPlain(tpl.sections[kind]) : null;
  const raw = isPlainObject(fromSections) ? fromSections : isPlainObject(tpl[kind]) ? toPlain(tpl[kind]) : null;
  if (!raw || raw.mode !== 'custom') return null;

  const limits = SECTION_LIMITS[kind];
  const height = clamp(toInt(raw.height, BAND_HEIGHTS[kind].default), limits.minHeight, limits.maxHeight);
  const elements = (Array.isArray(raw.elements) ? raw.elements : [])
    .slice(0, limits.maxItems)
    .map((element, index) => {
      const item = normalizeElement(element, index, { section: kind });
      item.variable = false;
      delete item.field;
      delete item.key;
      delete item.label;
      delete item.hint;
      delete item.maxLength;
      return item;
    });

  return {
    height,
    background: isPlainObject(raw.background) ? toPlain(raw.background) : undefined,
    elements,
  };
}

/**
 * Both bands of one poster, as they are drawn: which one wins, how tall it is, where it sits
 * and what to paint on it. Header and footer are resolved together because a pair of tall bands
 * has to shrink to leave room between them.
 */
export function resolveBands(brandKit, template) {
  const kit = toPlain(brandKit) || {};
  const size = templateSizeOf(template);
  const kitDefaultHeight = templateSizeOf({ size: kit.defaultPosterSize }).height;
  const bands = {};

  for (const kind of BRAND_BAND_KINDS) {
    const brand = normalizeBrandBand(undefined, kind, kit);
    const custom = templateCustomBand(template, kind);
    bands[kind] = custom
      ? {
          kind,
          source: 'template',
          mode: custom.elements.length > 0 ? 'elements' : 'legacy',
          height: custom.height,
          background: custom.background ?? brand.background,
          elements: custom.elements,
          brand,
        }
      : {
          kind,
          source: 'brand',
          mode: brand.mode,
          height: brand.height,
          background: brand.background,
          elements: brand.mode === 'elements' ? brand.elements : [],
          brand,
        };
  }

  /* A template may ask for a taller band than a brand kit can, so the pair is measured against
     the section limits; each band already carries the limits of whoever owns it. */
  const heights = bandPairHeights(size, bands.header.height, bands.footer.height, {
    header: { default: BAND_HEIGHTS.header.default, max: SECTION_LIMITS.header.maxHeight },
    footer: { default: BAND_HEIGHTS.footer.default, max: SECTION_LIMITS.footer.maxHeight },
  });
  bands.header.height = heights.header;
  bands.footer.height = heights.footer;
  bands.header.y = 0;
  bands.footer.y = Math.max(0, size.height - heights.footer);

  /* A brand band was placed against the poster its kit describes, so on a taller or shorter
     poster the footer's items travel with the band instead of being left behind mid-page. */
  const footer = bands.footer;
  if (footer.source === 'brand' && footer.elements.length > 0) {
    const authoredTop = kitDefaultHeight - normalizeBrandBand(undefined, 'footer', kit).height;
    const shift = footer.y - authoredTop;
    if (shift !== 0) {
      footer.elements = footer.elements.map((element) => ({ ...element, y: Math.max(0, element.y + shift) }));
    }
  }

  return bands;
}

/**
 * What to draw for one band of one poster: the template's own band when it asked for one,
 * otherwise the Brand Kit's - as items when the kit placed them, as its own settings when not.
 */
export function effectiveBand(brandKit, template, kind) {
  if (!BRAND_BAND_KINDS.includes(kind)) return undefined;
  return resolveBands(brandKit, template)[kind];
}
