import { posterContentJsonSchema, sanitizeString } from '../ai/schema.js';
import { elementsOfDesign, resolveContentValues, variableSlotsOf } from '../../../shared/templateElements.js';
import { DESIGN_BLANKS } from '../../../shared/designRecipes.js';

const DESIGN_BLANK_KEYS = new Set(Object.keys(DESIGN_BLANKS));

const schemaProps = posterContentJsonSchema.properties;

export const CONTENT_LIMITS = {
  title: schemaProps.title.maxLength,
  tagline: schemaProps.tagline.maxLength,
  date: schemaProps.date.maxLength,
  time: schemaProps.time.maxLength,
  venue: schemaProps.venue.maxLength,
  detail: schemaProps.details.items.maxLength,
  maxDetails: schemaProps.details.maxItems,
};

const ALLOWED_IMAGE_HOSTS = new Set(['res.cloudinary.com', 'images.pexels.com', 'images.unsplash.com']);

/** Two storage folders are split organization by organization, so the owner is readable. */
const TENANT_FOLDER = /(?:brand|tenants)\/([0-9a-f]{24})(?:\/|$)/i;

function reject(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function cleanText(value, field, max, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw reject(`${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw reject(`${field} must be text`);

  const cleaned = sanitizeString(value);
  if (cleaned.length > max) throw reject(`${field} cannot be longer than ${max} characters`);
  return cleaned;
}

/**
 * Only https URLs from our own storage or the Pexels image CDN are accepted, so a saved
 * poster can never point at a data: URI or an arbitrary third-party host. A storage address
 * that names another organization's folder is refused too.
 */
export function normalizeImageUrl(value, field = 'imageUrl', clientId = '') {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw reject(`${field} must be text`);

  const cleaned = sanitizeString(value);
  if (!cleaned) return '';

  let parsed;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw reject(`${field} must be a valid web address`);
  }
  if (parsed.protocol !== 'https:') throw reject(`${field} must use https`);
  if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
    throw reject(`${field} must come from your brand storage or the image library`);
  }
  const owner = parsed.pathname.match(TENANT_FOLDER);
  if (owner && clientId && owner[1].toLowerCase() !== String(clientId).toLowerCase()) {
    throw reject(`${field} must be a picture your own organization keeps`);
  }
  return cleaned;
}

/**
 * The blanks a poster's own frozen design offers, for validating what arrives in
 * content.extras / content.images. Takes the design snapshot, the template, or nothing
 * (a layout with no fill-ins then refuses any filled-in value).
 */
export function contentValuesContext(source = {}, clientId = null) {
  const design = plainish(source)?.design ?? plainish(source);
  const elements = Array.isArray(design?.elements) ? design.elements : elementsOfDesign(design);
  return {
    elements,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    clientId: clientId ? String(clientId) : '',
  };
}

function plainish(value) {
  if (value == null) return value;
  return typeof value.toObject === 'function' ? value.toObject() : value;
}

export function normalizePosterContent(raw, valuesContext = null) {
  if (!raw || typeof raw !== 'object') throw reject('Poster content is required');

  const details = raw.details === undefined || raw.details === null ? [] : raw.details;
  if (!Array.isArray(details)) throw reject('Extra lines must be a list');
  if (details.length > CONTENT_LIMITS.maxDetails) {
    throw reject(`A poster can have at most ${CONTENT_LIMITS.maxDetails} extra lines`);
  }

  const context = valuesContext || { elements: [], cloudName: '', clientId: '' };
  let sanitizedRaw = raw;
  if (raw.extras && typeof raw.extras === 'object' && !Array.isArray(raw.extras)) {
    const slots = variableSlotsOf(context.elements || []);
    const offeredKeys = new Set(slots.texts.map((s) => s.key));
    const filteredExtras = {};
    for (const [key, val] of Object.entries(raw.extras)) {
      if (offeredKeys.has(key) || !DESIGN_BLANK_KEYS.has(key)) {
        filteredExtras[key] = val;
      }
    }
    sanitizedRaw = { ...raw, extras: filteredExtras };
  }
  const values = resolveContentValues(sanitizedRaw, context);
  if (values.problems.length) throw reject(values.problems[0]);

  const content = {
    title: cleanText(raw.title, 'Title', CONTENT_LIMITS.title, { required: true }),
    tagline: cleanText(raw.tagline, 'Tagline', CONTENT_LIMITS.tagline),
    date: cleanText(raw.date, 'Date', CONTENT_LIMITS.date),
    time: cleanText(raw.time, 'Time', CONTENT_LIMITS.time),
    venue: cleanText(raw.venue, 'Venue', CONTENT_LIMITS.venue),
    details: details.map((item, index) => cleanText(item, `Extra line ${index + 1}`, CONTENT_LIMITS.detail)),
    imageUrl: normalizeImageUrl(raw.imageUrl, 'imageUrl', context.clientId),
  };
  if (values.extras) content.extras = values.extras;
  if (values.images) content.images = values.images;
  return content;
}
