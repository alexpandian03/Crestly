import { sanitizeString } from '../ai/schema.js';

export const BRAND_FONTS = [
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

export const TEXT_WEIGHTS = [400, 500, 600, 700];
export const BACKGROUND_TYPES = ['color', 'gradient', 'image'];
export const CONTENT_BACKGROUND_TYPES = ['color', 'gradient', 'image', 'pattern'];
export const IMAGE_FITS = ['cover', 'contain'];
export const BACKGROUND_POSITIONS = ['top', 'center', 'bottom', 'left', 'right'];
export const BACKGROUND_PATTERNS = ['none', 'dots', 'lines', 'grid'];
export const CONTENT_DECORATIONS = ['none', 'band', 'circle', 'corners'];
export const LOGO_POSITIONS = ['left', 'right', 'top', 'bottom'];
export const HEADER_ALIGNMENTS = ['left', 'center', 'right'];
export const FOOTER_LAYOUTS = [1, 2, 3];
export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'whatsapp'];
export const BRAND_PRESETS = ['professional', 'bold', 'minimal', 'festival', 'custom'];
export const BRAND_IMAGE_KINDS = ['header', 'content', 'footer', 'default', 'logo'];

export const RANGES = {
  fontSize: { min: 8, max: 200 },
  letterSpacing: { min: 0, max: 12 },
  gradientAngle: { min: 0, max: 360 },
  overlayOpacity: { min: 0, max: 1 },
  watermarkOpacity: { min: 0, max: 0.3 },
  headerHeight: { min: 60, max: 200 },
  footerHeight: { min: 60, max: 260 },
  logoSize: { min: 24, max: 160 },
  borderThickness: { min: 0, max: 8 },
  dividerThickness: { min: 0, max: 8 },
  cardRadius: { min: 0, max: 32 },
};

export const TEXT_LIMITS = {
  tagline: 80,
  address: 120,
  legalText: 160,
  phone: 40,
  email: 120,
  website: 120,
  orgNameText: 100,
};

export const MAX_SOCIAL_LINKS = 6;
export const SIGNATURE_LIMIT_PER_HOUR = 30;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/i;

export function isBrandColor(value) {
  return typeof value === 'string' && (HEX_COLOR.test(value.trim()) || RGB_COLOR.test(value.trim()));
}

export function normalizeBrandColor(value) {
  const color = String(value || '').trim();
  if (!HEX_COLOR.test(color)) return color;
  if (color.length === 4) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return color.toLowerCase();
}

export function sanitizePlainText(value, max = 200) {
  return sanitizeString(value).slice(0, max);
}

export const DEFAULT_TEXT_STYLE = {
  fontFamily: 'Inter',
  size: 20,
  weight: 500,
  color: '#0f172a',
  uppercase: false,
  letterSpacing: 0,
};

export const DEFAULT_BACKGROUND = {
  type: 'color',
  color: '#ffffff',
  gradientFrom: '#059669',
  gradientTo: '#0f172a',
  gradientAngle: 135,
  imageUrl: '',
  overlayColor: '#0b0f17',
  overlayOpacity: 0.4,
};

const DEFAULT_CONTENT_BACKGROUND = {
  ...DEFAULT_BACKGROUND,
  color: '#ffffff',
  fit: 'cover',
  position: 'center',
  pattern: 'none',
};

function textStyle(overrides) {
  return { ...DEFAULT_TEXT_STYLE, ...overrides };
}

function background(overrides) {
  return { ...DEFAULT_BACKGROUND, ...overrides };
}

export const BRAND_KIT_DEFAULTS = {
  preset: 'custom',
  textStyle: textStyle({ fontFamily: 'Outfit', size: 24, weight: 600 }),
  header: {
    height: 80,
    alignment: 'left',
    background: background({ color: 'rgba(15, 23, 42, 0.95)' }),
    logo: { show: true, size: 56, position: 'left' },
    orgName: {
      show: true,
      text: '',
      style: textStyle({ fontFamily: 'Outfit', size: 26, weight: 700, color: '#ffffff' }),
    },
    tagline: {
      show: false,
      text: '',
      style: textStyle({ size: 14, weight: 400, color: '#e2e8f0', letterSpacing: 1 }),
    },
    border: { show: false, color: '#059669', thickness: 2 },
  },
  content: {
    background: DEFAULT_CONTENT_BACKGROUND,
    decoration: 'none',
    decorationColor: '#059669',
    watermark: { show: false, opacity: 0.08 },
    headingColor: '#0f172a',
    bodyColor: '#334155',
    accentColor: '#059669',
    headingFont: 'Outfit',
    bodyFont: 'Inter',
    infoCard: {
      background: '#f8fafc',
      border: '#e2e8f0',
      radius: 16,
      iconColor: '#059669',
    },
    defaultImageUrl: '',
  },
  footer: {
    height: 70,
    layout: 2,
    background: background({ color: 'rgba(11, 15, 23, 0.98)' }),
    address: '',
    phone: '',
    email: '',
    website: '',
    social: [],
    legalText: '© All rights reserved.',
    style: textStyle({ size: 13, weight: 400, color: '#e2e8f0' }),
    linkColor: '#10b981',
    divider: { show: false, color: '#1f2937', thickness: 1 },
  },
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, incoming) {
  if (!isPlainObject(incoming)) return incoming === undefined ? base : incoming;
  const out = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(base?.[key]) ? mergeDeep(base[key], value) : value;
  }
  return out;
}

export function withBrandKitDefaults(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return syncDerivedFields(mergeDeep(BRAND_KIT_DEFAULTS, applyLegacyHints(source)));
}

/** Pre-upgrade kits drove these switches with flat fields; carry them into the new shape. */
function applyLegacyHints(source) {
  const hinted = { ...source };

  if (isPlainObject(source.header)) {
    hinted.header = { ...source.header };
    if (typeof source.header.showLogo === 'boolean' && source.header.logo?.show === undefined) {
      hinted.header.logo = { ...source.header.logo, show: source.header.showLogo };
    }
    if (typeof source.header.showOrgName === 'boolean' && source.header.orgName?.show === undefined) {
      hinted.header.orgName = { ...source.header.orgName, show: source.header.showOrgName };
    }
  }

  if (isPlainObject(source.content) || isPlainObject(source.fonts)) {
    hinted.content = { ...source.content };
    if (!hinted.content.headingFont) hinted.content.headingFont = source.fonts?.heading;
    if (!hinted.content.bodyFont) hinted.content.bodyFont = source.fonts?.body;
  }
  if (!source.textStyle?.fontFamily && source.fonts?.heading) {
    hinted.textStyle = { ...source.textStyle, fontFamily: source.fonts.heading };
  }

  return hinted;
}

/**
 * Keep the pre-upgrade fields the renderer and the AI prompt still read in step,
 * and rebuild the new shape when an old kit stored a background as a color string.
 */
function syncDerivedFields(kit) {
  const next = { ...kit };
  next.header = { ...next.header };
  next.footer = { ...next.footer };
  next.content = { ...next.content };

  if (typeof next.header.background === 'string') {
    next.header.background = background({ color: next.header.background });
  } else if (!isPlainObject(next.header.background)) {
    next.header.background = background({ color: BRAND_KIT_DEFAULTS.header.background.color });
  }
  if (typeof next.footer.background === 'string') {
    next.footer.background = background({ color: next.footer.background });
  } else if (!isPlainObject(next.footer.background)) {
    next.footer.background = background({ color: BRAND_KIT_DEFAULTS.footer.background.color });
  }

  next.header.showLogo = Boolean(next.header?.logo?.show);
  next.header.showOrgName = Boolean(next.header?.orgName?.show);

  if (!next.header?.orgName?.text) {
    next.header.orgName = { ...next.header.orgName, text: sanitizePlainText(next.orgName, TEXT_LIMITS.orgNameText) };
  }

  const hasNewContacts = Boolean(next.footer.phone || next.footer.email || next.footer.address);
  if (hasNewContacts) {
    next.footer.contactText = [next.footer.phone, next.footer.email, next.footer.address]
      .map((value) => sanitizePlainText(value, TEXT_LIMITS.address))
      .filter(Boolean)
      .join(' · ');
  } else {
    next.footer.contactText = sanitizePlainText(next.footer.contactText, TEXT_LIMITS.address);
  }

  const socialLinks = Array.isArray(next.footer.social) ? next.footer.social : [];
  if (socialLinks.length > 0) {
    next.footer.socials = socialLinks.map((item) =>
      sanitizePlainText(String(item?.url || '').replace(/^https?:\/\/(www\.)?/i, ''), 120)
    );
  } else if (!Array.isArray(next.footer.socials)) {
    next.footer.socials = [];
  }

  if (typeof next.content?.headingFont !== 'string' || !next.content.headingFont) {
    next.content.headingFont = BRAND_KIT_DEFAULTS.content.headingFont;
  }
  if (typeof next.content?.bodyFont !== 'string' || !next.content.bodyFont) {
    next.content.bodyFont = BRAND_KIT_DEFAULTS.content.bodyFont;
  }

  return next;
}

/**
 * Partial update over a stored kit: section objects merge key by key so a builder
 * can save one block at a time, arrays are replaced whole.
 */
export function mergeBrandKitUpdate(stored, incoming) {
  const base = withBrandKitDefaults(stored);
  if (!isPlainObject(incoming)) return base;
  const cleaned = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || key === 'clientId' || key === '_id') continue;
    cleaned[key] = value;
  }
  const merged = mergeDeep(base, cleaned);
  if (typeof cleaned?.header?.showLogo === 'boolean') {
    merged.header.logo = { ...merged.header.logo, show: cleaned.header.showLogo };
  }
  if (typeof cleaned?.header?.showOrgName === 'boolean') {
    merged.header.orgName = { ...merged.header.orgName, show: cleaned.header.showOrgName };
  }
  return syncDerivedFields(merged);
}

/** Paths a stored kit is missing, as dotted keys with their default values. */
export function collectMissingDefaultPaths(doc) {
  const missing = {};
  const walk = (defaults, current, prefix) => {
    for (const [key, value] of Object.entries(defaults)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(value)) {
        if (!isPlainObject(current?.[key])) {
          missing[path] = value;
        } else {
          walk(value, current[key], path);
        }
        continue;
      }
      if (current?.[key] === undefined) missing[path] = value;
    }
  };
  walk(BRAND_KIT_DEFAULTS, doc, '');
  if (typeof doc?.header?.background === 'string') {
    missing['header.background'] = background({ color: doc.header.background });
  }
  if (typeof doc?.footer?.background === 'string') {
    missing['footer.background'] = background({ color: doc.footer.background });
  }
  carryLegacySwitches(doc, missing);
  return missing;
}

/** An old kit's flat showLogo/showOrgName must not be lost when the new blocks appear. */
function carryLegacySwitches(doc, missing) {
  const hints = [
    ['header.logo', doc?.header?.showLogo, doc?.header?.logo?.show],
    ['header.orgName', doc?.header?.showOrgName, doc?.header?.orgName?.show],
  ];
  for (const [path, legacyValue, existing] of hints) {
    if (typeof legacyValue !== 'boolean' || existing !== undefined) continue;
    if (missing[path]) missing[path] = { ...missing[path], show: legacyValue };
    else missing[`${path}.show`] = legacyValue;
  }
}

export function brandImageFolder(clientId) {
  return `brand/${clientId}`;
}

/**
 * Brand images must live in this tenant's Cloudinary folder and nowhere else.
 */
export function brandImagePrefix() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  return cloudName && cloudName !== 'your_cloud_name'
    ? `https://res.cloudinary.com/${cloudName}/`
    : 'https://res.cloudinary.com/';
}

export function isBrandImageHost(url) {
  return typeof url === 'string' && url.trim().startsWith(brandImagePrefix());
}

export function isTenantBrandImage(url, clientId) {
  return typeof url === 'string' && url.includes(`/brand/${clientId}/`);
}

export function checkBrandImageUrl(url, clientId) {
  const value = typeof url === 'string' ? url.trim() : '';
  if (value === '') return { ok: true };
  if (!isBrandImageHost(value)) {
    return { ok: false, reason: `Images must be uploaded to your own image library (${brandImagePrefix()}...).` };
  }
  if (!isTenantBrandImage(value, clientId)) {
    return { ok: false, reason: 'That image belongs to another organization or another folder.' };
  }
  return { ok: true };
}
