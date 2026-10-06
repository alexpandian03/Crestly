import { posterContentJsonSchema, sanitizeString } from '../ai/schema.js';

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

const ALLOWED_IMAGE_HOSTS = new Set(['res.cloudinary.com', 'images.pexels.com']);

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
 * poster can never point at a data: URI or an arbitrary third-party host.
 */
export function normalizeImageUrl(value, field = 'imageUrl') {
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
  return cleaned;
}

export function normalizePosterContent(raw) {
  if (!raw || typeof raw !== 'object') throw reject('Poster content is required');

  const details = raw.details === undefined || raw.details === null ? [] : raw.details;
  if (!Array.isArray(details)) throw reject('Extra lines must be a list');
  if (details.length > CONTENT_LIMITS.maxDetails) {
    throw reject(`A poster can have at most ${CONTENT_LIMITS.maxDetails} extra lines`);
  }

  return {
    title: cleanText(raw.title, 'Title', CONTENT_LIMITS.title, { required: true }),
    tagline: cleanText(raw.tagline, 'Tagline', CONTENT_LIMITS.tagline),
    date: cleanText(raw.date, 'Date', CONTENT_LIMITS.date),
    time: cleanText(raw.time, 'Time', CONTENT_LIMITS.time),
    venue: cleanText(raw.venue, 'Venue', CONTENT_LIMITS.venue),
    details: details.map((item, index) => cleanText(item, `Extra line ${index + 1}`, CONTENT_LIMITS.detail)),
    imageUrl: normalizeImageUrl(raw.imageUrl),
  };
}
