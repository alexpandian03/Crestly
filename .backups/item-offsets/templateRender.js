/**
 * Turns a template into render values for <PosterCanvas>.
 *
 * Mirrors server/services/template/zones.js (LAYOUT_BASE, LAYOUT_OPTIONS,
 * FONT_DEFAULTS, TEMPLATE_SIZE_DEFAULT) on the client. Every field is optional,
 * so templates saved before the layout block existed fall back to the defaults
 * and keep rendering the way they always did.
 */

export const TEMPLATE_SIZE_DEFAULT = { width: 1080, height: 1350 };

export const LAYOUT_BASE = {
  alignment: 'left',
  spacing: 'normal',
  imagePlacement: 'none',
  infoStyle: 'stacked',
  decoration: 'none',
};

export const LAYOUT_OPTIONS = {
  alignment: ['left', 'center'],
  spacing: ['compact', 'normal', 'relaxed'],
  imagePlacement: ['top', 'middle', 'bottom', 'none'],
  infoStyle: ['card', 'inline', 'stacked'],
  decoration: ['none', 'band', 'circle'],
};

export const FONT_DEFAULTS = { minFont: 12, maxFont: 48 };
export const TEMPLATE_CATEGORIES = ['Event', 'Festival', 'Awareness', 'Achievement', 'Notice', 'Custom'];

/** Gap multiplier for the three spacing steps. */
const SPACING_FACTOR = { compact: 0.72, normal: 1, relaxed: 1.32 };

const numberOr = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pick = (value, options, fallback) => (options.includes(value) ? value : fallback);

const clampInt = (value, lo, hi, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

function zoneRect(zone, canvas) {
  return {
    x: clampInt(zone.x, 0, canvas.width, 0),
    y: clampInt(zone.y, 0, canvas.height, 0),
    w: Math.max(1, clampInt(zone.w, 1, canvas.width, 1)),
    h: Math.max(1, clampInt(zone.h, 1, canvas.height, 1)),
  };
}

export function templateIdOf(template) {
  return String(template?.id || template?._id || '');
}

/** Normalised template size, e.g. { width: 1080, height: 1350 }. */
export function resolveTemplateSize(template) {
  return {
    width: clampInt(template?.size?.width, 200, 4000, TEMPLATE_SIZE_DEFAULT.width),
    height: clampInt(template?.size?.height, 200, 4000, TEMPLATE_SIZE_DEFAULT.height),
  };
}

/**
 * @returns {{size: {width: number, height: number}, layout: object, zones: object}}
 * layout carries the five declared fields plus derived render numbers; zones
 * carries the content / image / header / footer rectangles (image is null when
 * the template has no photo area or the layout turns it off).
 */
export function resolveTemplateRender(template) {
  const size = resolveTemplateSize(template);
  const rawZones = Array.isArray(template?.zones) ? template.zones : [];
  const zoneOf = (type) => rawZones.find((z) => z?.type === type) || null;

  const header = zoneOf('header');
  const footer = zoneOf('footer');
  const contentZone = zoneOf('content');
  const imageZone = zoneOf('image');

  const base = { ...LAYOUT_BASE, imagePlacement: imageZone ? 'middle' : LAYOUT_BASE.imagePlacement };
  const raw = template?.layout || {};
  const layout = {
    alignment: pick(raw.alignment, LAYOUT_OPTIONS.alignment, base.alignment),
    spacing: pick(raw.spacing, LAYOUT_OPTIONS.spacing, base.spacing),
    imagePlacement: pick(raw.imagePlacement, LAYOUT_OPTIONS.imagePlacement, base.imagePlacement),
    infoStyle: pick(raw.infoStyle, LAYOUT_OPTIONS.infoStyle, base.infoStyle),
    decoration: pick(raw.decoration, LAYOUT_OPTIONS.decoration, base.decoration),
  };

  const content = contentZone
    ? zoneRect(contentZone, size)
    : { x: Math.round(size.width * 0.065), y: header ? numberOr(header.h, 140) : Math.round(size.height * 0.12), w: Math.round(size.width * 0.87), h: Math.round(size.height * 0.66) };

  const showImage = layout.imagePlacement !== 'none' && Boolean(imageZone);
  const image = showImage ? zoneRect(imageZone, size) : null;
  /* A template that has a photo area and turns it off shows no photo at all. */
  const hidePhoto = Boolean(imageZone) && layout.imagePlacement === 'none';

  const fonts = {
    minFont: clampInt(contentZone?.minFont, 8, 200, FONT_DEFAULTS.minFont),
    maxFont: clampInt(contentZone?.maxFont, 8, 200, FONT_DEFAULTS.maxFont),
  };
  if (fonts.maxFont < fonts.minFont) fonts.maxFont = fonts.minFont;

  return {
    size,
    layout: {
      ...layout,
      spacingFactor: SPACING_FACTOR[layout.spacing],
      centerColumn: layout.alignment === 'center',
      hidePhoto,
    },
    fonts,
    zones: {
      content,
      image,
      header: header ? zoneRect(header, size) : null,
      footer: footer ? zoneRect(footer, size) : null,
    },
  };
}

/** True when the photo sits inside the text column instead of its own band. */
export function imageInsideContent(image, content) {
  if (!image || !content) return false;
  return image.y >= content.y - 2 && image.y + image.h <= content.y + content.h + 2;
}
