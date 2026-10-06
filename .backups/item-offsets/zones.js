/**
 * Shared template geometry rules for Stage 9.
 * Every template write route (create, update, restore, duplicate) runs zones and layout
 * through these helpers, so a template can never be stored with areas that overlap,
 * fall outside the canvas, or are too small to read.
 */

export const TEMPLATE_CATEGORIES = ['Event', 'Festival', 'Awareness', 'Achievement', 'Notice', 'Custom'];

export const ZONE_TYPES = ['header', 'footer', 'content', 'image'];

export const TEMPLATE_SIZE_DEFAULT = { width: 1080, height: 1350 };

export const SIZE_LIMITS = { minWidth: 600, maxWidth: 2400, minHeight: 600, maxHeight: 3200 };

export const MIN_ZONE_WIDTH = 120;
export const MIN_ZONE_HEIGHT = 80;
export const MIN_CONTENT_HEIGHT_RATIO = 0.4;
export const MAX_ZONES = 6;

export const FONT_RANGE = { min: 10, max: 200 };

// Matches the Template model's zone defaults so stored and sent templates agree.
export const FONT_DEFAULTS = { minFont: 12, maxFont: 48 };

export const TEMPLATE_MAX_VERSIONS = 10;

export const LAYOUT_OPTIONS = {
  alignment: ['left', 'center'],
  spacing: ['compact', 'normal', 'relaxed'],
  imagePlacement: ['top', 'middle', 'bottom', 'none'],
  infoStyle: ['card', 'inline', 'stacked'],
  decoration: ['none', 'band', 'circle'],
};

export const LAYOUT_BASE = {
  alignment: 'left',
  spacing: 'normal',
  imagePlacement: 'none',
  infoStyle: 'stacked',
  decoration: 'none',
};

const ZONE_FIELDS = ['id', 'type', 'x', 'y', 'w', 'h', 'locked', 'minFont', 'maxFont'];
const ZONE_LABELS = { header: 'header', footer: 'footer', content: 'content', image: 'photo' };
const LOCKED_TYPES = new Set(['header', 'footer']);

function label(type) {
  return ZONE_LABELS[type] || type;
}

function toInt(value) {
  return Math.round(Number(value));
}

export function layoutDefaultsFor(zones = []) {
  const hasImage = zones.some((zone) => zone?.type === 'image');
  return { ...LAYOUT_BASE, imagePlacement: hasImage ? 'middle' : 'none' };
}

export function normalizeTemplateSize(size) {
  const width = toInt(size?.width ?? TEMPLATE_SIZE_DEFAULT.width);
  const height = toInt(size?.height ?? TEMPLATE_SIZE_DEFAULT.height);
  return { width, height };
}

export function normalizeLayout(layout, zones) {
  const base = layoutDefaultsFor(zones);
  return {
    alignment: layout?.alignment || base.alignment,
    spacing: layout?.spacing || base.spacing,
    imagePlacement: layout?.imagePlacement || base.imagePlacement,
    infoStyle: layout?.infoStyle || base.infoStyle,
    decoration: layout?.decoration || base.decoration,
  };
}

/**
 * Keeps only known zone fields (any content/text a client sends is dropped: header and
 * footer text always comes from the brand kit), rounds pixels, and locks header + footer.
 */
export function normalizeZones(zones = []) {
  return zones.map((zone) => {
    const clean = {};
    for (const field of ZONE_FIELDS) {
      if (zone?.[field] !== undefined) clean[field] = zone[field];
    }
    clean.id = String(clean.id ?? `zone-${clean.type}`).trim().slice(0, 80);
    clean.type = clean.type;
    clean.x = toInt(clean.x ?? 0);
    clean.y = toInt(clean.y ?? 0);
    clean.w = toInt(clean.w ?? 0);
    clean.h = toInt(clean.h ?? 0);
    clean.minFont = toInt(clean.minFont ?? FONT_DEFAULTS.minFont);
    clean.maxFont = toInt(clean.maxFont ?? FONT_DEFAULTS.maxFont);
    clean.locked = LOCKED_TYPES.has(clean.type) ? true : Boolean(clean.locked);
    return clean;
  });
}

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function checkZoneLayout({ size, zones }) {
  const canvas = normalizeTemplateSize(size);
  const problems = [];

  if (canvas.width < SIZE_LIMITS.minWidth || canvas.width > SIZE_LIMITS.maxWidth) {
    problems.push(
      `Poster width must be between ${SIZE_LIMITS.minWidth} and ${SIZE_LIMITS.maxWidth}.`
    );
  }
  if (canvas.height < SIZE_LIMITS.minHeight || canvas.height > SIZE_LIMITS.maxHeight) {
    problems.push(
      `Poster height must be between ${SIZE_LIMITS.minHeight} and ${SIZE_LIMITS.maxHeight}.`
    );
  }
  if (!Array.isArray(zones) || zones.length === 0) {
    problems.push('A template needs a header, a footer and a content area.');
    return problems;
  }
  if (zones.length > MAX_ZONES) {
    problems.push(`A template can have at most ${MAX_ZONES} areas.`);
  }

  const byType = (type) => zones.filter((zone) => zone?.type === type);
  if (byType('header').length !== 1) problems.push('A template needs exactly one header area.');
  if (byType('footer').length !== 1) problems.push('A template needs exactly one footer area.');
  if (byType('content').length !== 1) problems.push('A template needs exactly one content area.');
  if (byType('image').length > 1) problems.push('A template can have only one photo area.');
  if (problems.length) return problems;

  const ids = new Set();
  for (const zone of zones) {
    if (ids.has(zone.id)) problems.push(`Two areas use the name “${zone.id}”. Give each area its own name.`);
    ids.add(zone.id);
  }

  for (const zone of zones) {
    if (zone.w < MIN_ZONE_WIDTH || zone.h < MIN_ZONE_HEIGHT) {
      problems.push(
        `The ${label(zone.type)} area is too small. It must be at least ${MIN_ZONE_WIDTH} × ${MIN_ZONE_HEIGHT}.`
      );
    }
    if (
      zone.x < 0 ||
      zone.y < 0 ||
      zone.x + zone.w > canvas.width ||
      zone.y + zone.h > canvas.height
    ) {
      problems.push(`The ${label(zone.type)} area must sit fully inside the poster.`);
    }
    if (zone.minFont > zone.maxFont) {
      problems.push(`The ${label(zone.type)} area has a text size range that goes the wrong way.`);
    }
  }

  const content = byType('content')[0];
  if (content.h < canvas.height * MIN_CONTENT_HEIGHT_RATIO) {
    problems.push('The content area must cover at least 40% of the poster height.');
  }

  const fixed = [byType('header')[0], byType('footer')[0], content];
  for (let i = 0; i < fixed.length; i += 1) {
    for (let j = i + 1; j < fixed.length; j += 1) {
      if (overlaps(fixed[i], fixed[j])) {
        problems.push(
          `The ${label(fixed[i].type)} area and the ${label(fixed[j].type)} area cannot overlap.`
        );
      }
    }
  }

  return [...new Set(problems)];
}

export function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/** Throws a 400 with the first friendly problem message. */
export function assertZoneLayout({ size, zones }) {
  const problems = checkZoneLayout({ size, zones });
  if (problems.length > 0) throw badRequest(problems[0]);
}
