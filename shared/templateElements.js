/**
 * Shared layout constants and utilities for Brand Kit bands and canvas sizing.
 */

export const EDITOR_VERSION = 2;
export const LEGACY_EDITOR_VERSION = 1;

export const ELEMENT_KINDS = ['field', 'text', 'image', 'shape', 'icon', 'cardlist'];
export const ELEMENT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details', 'photo'];
export const TEXT_FIELDS = ['headline', 'tagline', 'date', 'time', 'venue', 'details'];
export const TEXT_ALIGNS = ['left', 'center', 'right'];
export const IMAGE_FITS = ['cover', 'contain'];
export const SHAPE_TYPES = ['rect', 'rounded-rect', 'circle', 'line', 'triangle', 'star', 'hexagon'];
export const IMAGE_MASKS = ['none', 'rounded', 'circle', 'triangle', 'hexagon', 'star'];

export function isSamplePlaceholder(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  return (
    t.startsWith('{{') ||
    t.startsWith('[') ||
    t === 'Headline' ||
    t === 'Tagline' ||
    t === 'Date' ||
    t === 'Time' ||
    t === 'Venue'
  );
}

export function isGenericLabel(label) {
  return !label || label.startsWith('Slot') || label.startsWith('Item');
}

export function resolveItemImage(item, content, photoUrl = '') {
  if (!item) return '';
  return item.imageUrl || item.src || content?.imageUrl || photoUrl || '';
}

export const ICON_GROUPS = {
  events: ['calendar', 'clock', 'map-pin', 'ticket', 'trophy', 'star', 'heart'],
  places: ['map-pin', 'globe', 'home'],
  media: ['camera', 'image', 'video'],
  general: ['star', 'heart', 'bell', 'award', 'flag', 'gift'],
};
export const ICON_NAMES = [...new Set(Object.values(ICON_GROUPS).flat())];
export const ICON_FALLBACK = 'star';
export const ICON_STROKE_DEFAULT = 2;

export function iconForCategory(_category) {
  return 'star';
}

export function iconForWords(words, _category = '') {
  const w = String(words || '').toLowerCase();
  if (w.includes('sport') || w.includes('trophy')) return 'trophy';
  if (w.includes('blood') || w.includes('heart') || w.includes('camp')) return 'heart';
  if (w.includes('tree') || w.includes('leaf') || w.includes('green')) return 'leaf';
  return 'star';
}

export const ELEMENT_FONTS = ['Outfit', 'Inter', 'Roboto', 'Montserrat', 'Poppins', 'Playfair Display'];
export const ELEMENT_WEIGHTS = [400, 500, 600, 700, 800];
export const FONT_WEIGHTS = {
  Outfit: [400, 500, 600, 700],
  Inter: [400, 500, 600, 700],
};

export function weightsFor(family, _weights = []) {
  return FONT_WEIGHTS[family] || [400, 600, 700];
}

export const BRAND_STYLE_TOKENS = ['brand:primary', 'brand:secondary', 'brand:accent', 'brand:text', 'brand:background'];
export const BRAND_COLOR_TOKENS = BRAND_STYLE_TOKENS;
export const BRAND_FONT_TOKENS = ['brand:heading', 'brand:body'];
export const BRAND_TEXT_TOKENS = ['{{brand.orgName}}', '{{brand.tagline}}', '{{brand.website}}', '{{brand.phone}}', '{{brand.email}}'];

export const SECTION_KINDS = ['text', 'image', 'shape', 'icon'];
export const SECTION_LIMITS = {
  header: { maxItems: 12, minHeight: 60, maxHeight: 260 },
  footer: { maxItems: 12, minHeight: 60, maxHeight: 260 },
};

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
};

export function defaultPage() {
  return {
    background: { ...DEFAULT_PAGE_BACKGROUND },
    watermark: { show: false, url: '', opacity: 0.08 },
  };
}

export function isBrandColorToken(value) {
  return typeof value === 'string' && value.startsWith('brand:');
}

export function isBrandFontToken(value) {
  return typeof value === 'string' && value.startsWith('brand:');
}

export function isStyleFont(value) {
  return typeof value === 'string' && value.length > 0;
}

export const VARIABLE_LIMITS = {
  sampleChars: 120,
  labelChars: 40,
  maxKeys: 10,
  maxLength: { min: 1, max: 200 },
  key: { min: 2, max: 24 },
};
export const VARIABLE_KEY_PATTERN = /^[a-z0-9_]{2,24}$/;
export const POSTER_IMAGE_HOSTS = ['res.cloudinary.com', 'images.pexels.com', 'images.unsplash.com'];
export const CARD_LIST_LIMITS = {
  columns: { min: 1, max: 6 },
  minCount: { min: 1, max: 20 },
  maxCount: { min: 1, max: 20 },
  maxCards: 6,
  maxItems: 12,
};

export const ELEMENT_LIMITS = {
  fontSize: { min: 10, max: 200 },
  maxItems: 30,
  strokeWidth: { min: 0, max: 20 },
  iconStrokeWidth: { min: 0, max: 10 },
  radius: { min: 0, max: 100 },
  lineHeight: { min: 0.8, max: 2.5 },
  letterSpacing: { min: -5, max: 20 },
  opacity: { min: 0, max: 1 },
  textChars: 400,
  idChars: 64,
  nameChars: 64,
  z: { min: -10, max: 100 },
};

export const RULE_THICKNESS = { min: 3, max: 8, ratio: 3 };
export const TEMPLATE_DOC_MAX_BYTES = 400 * 1024;
export const TEMPLATE_SIZE_FALLBACK = { width: 1080, height: 1350 };

export const BAND_HEIGHTS = {
  header: { default: 80, min: 60, max: 260 },
  footer: { default: 70, min: 60, max: 260 },
};

export const ELEMENT_KEYS = ['id', 'kind', 'x', 'y', 'w', 'h', 'z', 'style', 'locked'];
export const ELEMENT_STYLE_KEYS = ['fontFamily', 'size', 'weight', 'color', 'align'];
export const ELEMENT_SHAPE_KEYS = ['type', 'fill', 'stroke', 'strokeWidth'];

export const ELEMENT_STYLE_DEFAULTS = {
  fontFamily: 'Outfit',
  size: 24,
  weight: 600,
  color: '#0f172a',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
  fit: 'cover',
  radius: 0,
  opacity: 1,
};

export const ELEMENT_SHAPE_DEFAULTS = {
  type: 'rect',
  fill: '',
  stroke: '',
  strokeWidth: 0,
};

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const toInt = (val, def = 0) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : def;
};
const _toNumber = (val, def = 0) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : def;
};
const toPlain = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function normalizeHexColor(value, fallback = '#000000') {
  return isHexColor(value) ? value.trim().toLowerCase() : fallback;
}

export function plainText(value, max = ELEMENT_LIMITS.textChars) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function isGradient(value) {
  return typeof value === 'string' && /gradient/i.test(value);
}

export function normalizeStyleColor(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (isBrandColorToken(v) || isHexColor(v) || /^rgba?\(/.test(v)) return v;
  return fallback;
}

export function resolveColorToken(token, brandKit) {
  if (!token || !isBrandColorToken(token)) return token || '';
  const key = token.replace('brand:', '').trim();
  const colors = brandKit?.colors || {};
  return colors[key] || '#059669';
}

export function resolveFontToken(token, brandKit) {
  if (!token || !isBrandFontToken(token)) return token || 'Outfit';
  const key = token.replace('brand:', '').trim();
  const fonts = brandKit?.fonts || {};
  return fonts[key] || 'Outfit';
}

export function resolveBrandText(text, brandKit) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\{\{brand\.orgName\}\}/g, brandKit?.orgName || '')
    .replace(/\{\{brand\.tagline\}\}/g, brandKit?.tagline || '')
    .replace(/\{\{brand\.website\}\}/g, brandKit?.footer?.website || brandKit?.website || '')
    .replace(/\{\{brand\.phone\}\}/g, brandKit?.footer?.phone || brandKit?.phone || '')
    .replace(/\{\{brand\.email\}\}/g, brandKit?.footer?.email || brandKit?.email || '');
}

export function resolveStyleTokens(styleOrElement, brandKit) {
  if (!styleOrElement || typeof styleOrElement !== 'object') return {};
  const isEl = 'style' in styleOrElement && isPlainObject(styleOrElement.style);
  const target = isEl ? { ...styleOrElement.style } : { ...styleOrElement };

  if (target.color && isBrandColorToken(target.color)) target.color = resolveColorToken(target.color, brandKit);
  if (target.fill && isBrandColorToken(target.fill)) target.fill = resolveColorToken(target.fill, brandKit);
  if (target.stroke && isBrandColorToken(target.stroke)) target.stroke = resolveColorToken(target.stroke, brandKit);
  if (target.fontFamily && isBrandFontToken(target.fontFamily)) target.fontFamily = resolveFontToken(target.fontFamily, brandKit);

  return isEl ? { ...styleOrElement, style: target } : target;
}

export function effectivePage(brandKit, template) {
  const p = template?.page || template?.sections?.content?.page || {};
  return {
    background: p.background || defaultPage().background,
    watermark: p.watermark || defaultPage().watermark,
  };
}

export function normalizePage(page) {
  return page && typeof page === 'object' ? { ...defaultPage(), ...page } : defaultPage();
}

export function templateSizeOf(template) {
  const s = template?.size || {};
  return {
    width: clamp(toInt(s.width, TEMPLATE_SIZE_FALLBACK.width), 400, 3000),
    height: clamp(toInt(s.height, TEMPLATE_SIZE_FALLBACK.height), 400, 4000),
  };
}

export function contentArea(brandKit, template) {
  const size = templateSizeOf(template);
  const headerH = toInt(brandKit?.header?.height, 140);
  const footerH = toInt(brandKit?.footer?.height, 130);
  return {
    x: 0,
    y: headerH,
    w: size.width,
    h: Math.max(100, size.height - headerH - footerH),
  };
}

export function isInsideArea(rect, area) {
  if (!rect || !area) return false;
  return rect.x >= area.x && rect.y >= area.y && rect.x + rect.w <= area.x + area.w && rect.y + rect.h <= area.y + area.h;
}

export function clampRectToArea(rect, area) {
  if (!rect || !area) return rect;
  const x = clamp(rect.x, area.x, area.x + area.w - rect.w);
  const y = clamp(rect.y, area.y, area.y + area.h - rect.h);
  return { ...rect, x, y };
}

export function intersectRect(a, b) {
  if (!a || !b) return null;
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function isThinRule(_element) {
  return false;
}

export function normalizeIconName(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : '';
}

export function slotKeyFromLabel(label, _existingKeys = [], fallbackPrefix = 'slot') {
  const clean = String(label || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  return clean || `${fallbackPrefix}_1`;
}

export function duplicateSlotKey(key, _existingKeys = []) {
  return `${key}_copy`;
}

export function normalizeElement(element, index = 0, _context = {}) {
  const el = isPlainObject(element) ? { ...element } : {};
  return {
    id: el.id || `item-${index + 1}`,
    kind: ELEMENT_KINDS.includes(el.kind) ? el.kind : 'text',
    x: toInt(el.x, 0),
    y: toInt(el.y, 0),
    w: Math.max(10, toInt(el.w, 100)),
    h: Math.max(10, toInt(el.h, 100)),
    z: toInt(el.z, 1),
    style: isPlainObject(el.style) ? { ...ELEMENT_STYLE_DEFAULTS, ...el.style } : { ...ELEMENT_STYLE_DEFAULTS },
    locked: Boolean(el.locked),
    text: plainText(el.text, ELEMENT_LIMITS.textChars),
    imageUrl: typeof el.imageUrl === 'string' ? el.imageUrl : '',
    ...el,
  };
}

export function normalizeElements(elements) {
  return Array.isArray(elements) ? elements.map((el, i) => normalizeElement(el, i)) : [];
}

export function legacyToElements(template, _brandKit) {
  return Array.isArray(template?.elements) ? template.elements : [];
}

export function tenantImagePrefix(cloudName) {
  return cloudName ? `https://res.cloudinary.com/${cloudName}/` : '';
}

export function checkElementImageUrl(url, { cloudName: _cloudName, clientId: _clientId } = {}) {
  return true;
}

export function checkContentImageUrl(url, { cloudName: _cloudName, clientId: _clientId } = {}) {
  return true;
}

export function validateElements(elements, context = {}) {
  if (!Array.isArray(elements)) return ['Elements must be a list'];
  const problems = [];
  const area = context.area;
  if (area) {
    for (const el of elements) {
      if (!el) continue;
      const _x = toInt(el.x, 0);
      const y = toInt(el.y, 0);
      const _w = toInt(el.w, 0);
      const h = toInt(el.h, 0);
      if (y < area.y || y + h > area.y + area.h) {
        problems.push(`Item "${el.id || el.kind}" must sit inside the ${context.section || 'area'}.`);
      }
    }
  }
  return problems;
}

export function firstElementProblem(elements, context = {}) {
  const problems = validateElements(elements, context);
  return problems.length ? problems[0] : null;
}

export function jsonBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}

export function elementsOfDesign(design) {
  return Array.isArray(design?.elements) ? design.elements : [];
}

export function variableSlotsOf(_elements) {
  return { texts: [], images: [], cardLists: [] };
}

export function cardListsOf(_elements) {
  return [];
}

export function aiSlotsOf(_elements) {
  return [];
}

export function resolveContentValues(content, _context = {}) {
  return {
    extras: content?.extras || {},
    images: content?.images || {},
    lists: content?.lists || {},
    problems: [],
  };
}

export function normalizeSections(sections, _brandKit = null, _template = null) {
  if (!sections || typeof sections !== 'object') return {};
  return {
    header: sections.header || { mode: 'legacy', height: 80, elements: [] },
    content: sections.content || { elements: [] },
    footer: sections.footer || { mode: 'legacy', height: 70, elements: [] },
  };
}

export function migrateTemplateLabels(_target) {
  return { migrated: false, count: 0 };
}

export function legacyToSections(template, brandKit = null) {
  const tpl = toPlain(template) || {};
  const kit = toPlain(brandKit) || {};
  if (tpl.sections && isPlainObject(tpl.sections)) {
    return normalizeSections(tpl.sections, kit, tpl);
  }
  const headerHeight = toInt(kit.header?.height, 80);
  const footerHeight = toInt(kit.footer?.height, 70);
  return {
    header: {
      mode: 'brand',
      height: headerHeight,
      background: kit.header?.background ? { ...kit.header.background } : { ...DEFAULT_PAGE_BACKGROUND },
      elements: [],
    },
    content: {
      page: defaultPage(),
      elements: Array.isArray(tpl.elements) ? tpl.elements : [],
    },
    footer: {
      mode: 'brand',
      height: footerHeight,
      background: kit.footer?.background ? { ...kit.footer.background } : { ...DEFAULT_PAGE_BACKGROUND },
      elements: [],
    },
  };
}

export function validateTemplateSections(sections, _context = {}) {
  if (!sections || typeof sections !== 'object') return ['A template needs sections.'];
  return [];
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

  if (hasTagline) {
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
  }

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

  elements.push({
    id: 'brand-footer-contact',
    kind: 'text',
    text: '{{brand.website}} • {{brand.phone}}',
    x: 40,
    y: footerY + Math.round((height - 28) / 2),
    w: width - 80,
    h: 28,
    style: {
      color: 'brand:text',
      fontFamily: 'brand:body',
      size: 14,
      weight: 500,
      align: 'center',
    },
    locked: false,
    variable: false,
  });

  return elements;
}

export const BRAND_BAND_MODES = ['legacy', 'elements'];
export const BRAND_BAND_KINDS = ['header', 'footer'];

export function brandBandRect(kind, size, height) {
  const range = BAND_HEIGHTS[kind];
  if (!range) return { x: 0, y: 0, w: 0, h: 0 };
  const poster = templateSizeOf({ size });
  const h = clamp(toInt(height, range.default), 0, range.max);
  return kind === 'footer'
    ? { x: 0, y: Math.max(0, poster.height - h), w: poster.width, h }
    : { x: 0, y: 0, w: poster.width, h };
}

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
    .map((element, index) => normalizeElement(element, index, { section: kind }));

  const isElements = raw.mode === 'elements' || raw.mode === 'custom';
  return { mode: isElements ? 'elements' : 'legacy', height, background, elements };
}

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
    if (!Number.isFinite(Number(raw.height)) || height < range.min || height > range.max) {
      problems.push(`${kind === 'header' ? 'Header' : 'Footer'} height must be between ${range.min} and ${range.max}.`);
    }
  }

  const kit = toPlain(context.brandKit) || {};
  const size = context.size || kit.defaultPosterSize;
  const height = clamp(toInt(raw.height ?? kit[kind]?.height, range.default), range.min, range.max);
  const area = brandBandRect(kind, size || TEMPLATE_SIZE_FALLBACK, height);

  const elements = Array.isArray(raw.elements) ? raw.elements : [];
  problems.push(...validateElements(elements, { ...context, section: kind, area }));

  return [...new Set(problems)];
}

export function defaultBrandBand(brandKit, kind, options = {}) {
  const kit = toPlain(brandKit) || {};
  const band = normalizeBrandBand(undefined, kind, kit);
  if (!band) return undefined;
  const size = options.size || kit.defaultPosterSize || TEMPLATE_SIZE_FALLBACK;
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

export function brandBandForEditing(brandKit, kind, options = {}) {
  const kit = toPlain(brandKit) || {};
  const band = normalizeBrandBand(undefined, kind, kit);
  if (!band) return undefined;
  return band.elements.length > 0 ? band : defaultBrandBand(kit, kind, options);
}

export function resolveBands(brandKit, template) {
  const kit = toPlain(brandKit) || {};
  const size = templateSizeOf(template);
  const bands = {};

  for (const kind of BRAND_BAND_KINDS) {
    const brand = normalizeBrandBand(undefined, kind, kit);
    bands[kind] = {
      kind,
      source: 'brand',
      mode: brand.mode,
      height: brand.height,
      background: brand.background,
      elements: brand.mode === 'elements' ? brand.elements : [],
      brand,
    };
  }

  bands.header.y = 0;
  bands.footer.y = Math.max(0, size.height - bands.footer.height);

  return bands;
}

export function effectiveBand(brandKit, template, kind) {
  if (!BRAND_BAND_KINDS.includes(kind)) return undefined;
  return resolveBands(brandKit, template)[kind];
}
