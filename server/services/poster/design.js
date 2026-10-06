import { badRequest, normalizeLayout, normalizeZones } from '../template/zones.js';
import { withBrandKitDefaults } from '../brand/style.js';
import {
  EDITOR_VERSION,
  ELEMENT_LIMITS,
  LEGACY_EDITOR_VERSION,
  VARIABLE_LIMITS,
  normalizeElements,
} from '../../../shared/templateElements.js';

/* A poster keeps the look it was made with: a small, self-contained copy of the brand kit
   and template is stored on the poster (and on every version) when it is saved. */
export const DESIGN_MAX_BYTES = 60 * 1024;

const BRAND_KEYS = [
  'orgName',
  'logos',
  'colors',
  'fonts',
  'preset',
  'textStyle',
  'header',
  'content',
  'footer',
  'defaultPosterSize',
];

const FORBIDDEN_KEYS = new Set([
  '_id',
  'id',
  'clientId',
  'userId',
  '__v',
  'password',
  'passwordHash',
  'secret',
  'token',
  'apiKey',
  'apiSecret',
  'signature',
]);

const MAX_STRING = 600;
const MAX_ARRAY = 12;
const MAX_DEPTH = 6;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function plain(value) {
  if (value == null) return value;
  return typeof value.toObject === 'function' ? value.toObject() : value;
}

/* Only https URLs survive: anything else that looks like a location is blanked, so a
   snapshot can never point at an insecure or data: resource. */
function cleanString(value, max = MAX_STRING) {
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  if (/^(https:\/\/)/i.test(text)) return text;
  if (/^(http:|data:|file:|ftp:|\/\/)/i.test(text)) return '';
  return text;
}

function prune(value, depth = 0) {
  if (depth > MAX_DEPTH) return undefined;
  if (value == null) return undefined;
  if (typeof value === 'string') return cleanString(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY)
      .map((entry) => prune(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key) || !/^[A-Za-z0-9_.-]{1,40}$/.test(key)) continue;
      const cleaned = prune(entry, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return undefined;
}

export function brandKitSnapshot(brandKit) {
  const filled = withBrandKitDefaults(plain(brandKit) || {});
  const source = {};
  for (const key of BRAND_KEYS) {
    if (filled[key] !== undefined) source[key] = filled[key];
  }
  return prune(source) || {};
}

/* Editor items are kept whole (a poster can hold up to thirty of them, more than the
   generic prune allows) but every string in them still goes through the same cleaning.
   A fill-in slot keeps its name, its label and its hint, so an old poster still knows
   which blanks its own design offered even after the template moves on. */
function elementSnapshot(elements) {
  return normalizeElements(elements)
    .slice(0, ELEMENT_LIMITS.maxItems)
    .map((element) => {
      const snapshot = {
        ...element,
        id: cleanString(element.id, ELEMENT_LIMITS.idChars),
        text: cleanString(element.text || '', ELEMENT_LIMITS.textChars),
        imageUrl: cleanString(element.imageUrl || '', 600),
      };
      if (snapshot.variable) {
        snapshot.key = cleanString(snapshot.key || '', VARIABLE_LIMITS.key.max);
        snapshot.label = cleanString(snapshot.label || '', VARIABLE_LIMITS.labelChars);
        snapshot.hint = cleanString(snapshot.hint || '', VARIABLE_LIMITS.hintChars);
      }
      return snapshot;
    });
}

export function templateSnapshot(template) {
  if (!template) return null;
  const raw = plain(template) || {};
  const zones = normalizeZones(raw.zones).map((zone) => ({
    id: cleanString(zone.id, 60),
    type: zone.type,
    x: Math.round(zone.x),
    y: Math.round(zone.y),
    w: Math.round(zone.w),
    h: Math.round(zone.h),
    locked: Boolean(zone.locked),
    minFont: Math.round(zone.minFont),
    maxFont: Math.round(zone.maxFont),
  }));
  const elements = elementSnapshot(raw.elements);
  const snapshot = prune({
    templateId: String(raw._id || raw.templateId || ''),
    name: cleanString(raw.name, 120),
    size: {
      width: Math.round(raw.size?.width || 1080),
      height: Math.round(raw.size?.height || 1350),
    },
    zones,
    layout: normalizeLayout(plain(raw.layout), zones),
    version: Math.max(1, Math.round(Number(raw.version) || 1)),
    editorVersion:
      Number(raw.editorVersion) === EDITOR_VERSION || elements.length > 0
        ? EDITOR_VERSION
        : LEGACY_EDITOR_VERSION,
    /* A design built from a recipe keeps its name, its arrangement and its mark, so a poster
       made that way can be re-built against a later brand kit and still look like itself. */
    recipeId: typeof raw.recipeId === 'string' ? cleanString(raw.recipeId, 40) : undefined,
    variant: Number.isFinite(Number(raw.variant)) ? Math.round(Number(raw.variant)) : undefined,
    recipeVersion: Number.isFinite(Number(raw.recipeVersion))
      ? Math.round(Number(raw.recipeVersion))
      : undefined,
    icon: typeof raw.icon === 'string' ? cleanString(raw.icon, 40) : undefined,
  });
  if (elements.length > 0) snapshot.elements = elements;
  return snapshot;
}

export function designBytes(design) {
  return Buffer.byteLength(JSON.stringify(design ?? {}), 'utf8');
}

export function assertDesignSize(design) {
  const bytes = designBytes(design);
  if (bytes > DESIGN_MAX_BYTES) {
    throw badRequest('The saved design is too large to store with this poster.');
  }
  return bytes;
}

/** Builds the frozen look of a poster from the tenant's current brand kit and template. */
export function captureDesign({ brandKit, template }) {
  const design = {
    brandKit: brandKitSnapshot(brandKit),
    template: templateSnapshot(template),
    capturedAt: new Date(),
  };
  assertDesignSize(design);
  return design;
}
