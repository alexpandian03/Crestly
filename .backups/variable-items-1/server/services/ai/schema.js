import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

export const posterContentJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 60 },
    tagline: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 30 },
    time: { type: 'string', maxLength: 20 },
    venue: { type: 'string', maxLength: 80 },
    details: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', maxLength: 90 },
    },
    imageQuery: { type: 'string', maxLength: 60 },
    imageUrl: { type: 'string' },
  },
  required: ['title', 'tagline', 'date', 'time', 'venue', 'details', 'imageQuery'],
  additionalProperties: false,
};

const validateCompiled = ajv.compile(posterContentJsonSchema);

/**
 * Remove HTML tags and control characters from string
 */
export function sanitizeString(val) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Strip control chars
    .trim();
}

/**
 * Truncate string at a word boundary without breaking words
 */
export function truncateAtWordBoundary(str, max) {
  if (!str || str.length <= max) return str || '';
  const truncated = str.slice(0, max);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > Math.floor(max * 0.6)) {
    return truncated.slice(0, lastSpace).trim();
  }
  return truncated.trim();
}

/**
 * Clean, sanitize and truncate entire poster content object
 */
export function sanitizeAndTruncateContent(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const title = truncateAtWordBoundary(sanitizeString(raw.title), 60);
  const tagline = truncateAtWordBoundary(sanitizeString(raw.tagline), 100);
  const date = truncateAtWordBoundary(sanitizeString(raw.date), 30);
  const time = truncateAtWordBoundary(sanitizeString(raw.time), 20);
  const venue = truncateAtWordBoundary(sanitizeString(raw.venue), 80);
  const imageQuery = truncateAtWordBoundary(sanitizeString(raw.imageQuery), 60);

  let rawDetails = Array.isArray(raw.details) ? raw.details : [];
  const details = rawDetails
    .slice(0, 4)
    .map((item) => truncateAtWordBoundary(sanitizeString(item), 90))
    .filter((d) => d.length > 0);

  return {
    title,
    tagline,
    date,
    time,
    venue,
    details,
    imageQuery,
  };
}

/**
 * Validate object against the poster content schema
 */
export function validatePosterContent(data) {
  const valid = validateCompiled(data);
  return {
    valid: Boolean(valid),
    errors: validateCompiled.errors || null,
  };
}
