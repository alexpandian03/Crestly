import Ajv from 'ajv';
import { VARIABLE_LIMITS } from '../../../shared/templateElements.js';

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
    /* Words filled into the template's own blanks. A poster written before fill-ins existed
       has none, and the strict shape (which keys, how long) is built from the template. */
    extras: {
      type: 'object',
      maxProperties: VARIABLE_LIMITS.maxText,
      additionalProperties: { type: 'string', maxLength: VARIABLE_LIMITS.maxLength.max },
    },
  },
  required: ['title', 'tagline', 'date', 'time', 'venue', 'details', 'imageQuery'],
  additionalProperties: false,
};

const validateCompiled = ajv.compile(posterContentJsonSchema);

/**
 * The same schema with `extras` locked to the blanks one template actually offers, so a
 * helper key the model invented cannot get through.
 */
function contentSchemaFor(slots) {
  const properties = {};
  for (const slot of slots) {
    properties[slot.key] = { type: 'string', maxLength: slot.maxLength };
  }
  return {
    ...posterContentJsonSchema,
    properties: {
      ...posterContentJsonSchema.properties,
      extras: { type: 'object', properties, additionalProperties: false },
    },
  };
}

/* One compiled schema per set of blanks; a compile cache only, nothing that must survive. */
const slotValidators = new Map();

function validatorFor(slots) {
  const signature = slots.map((slot) => `${slot.key}:${slot.maxLength}`).join('|');
  let validator = slotValidators.get(signature);
  if (!validator) {
    validator = ajv.compile(contentSchemaFor(slots));
    slotValidators.set(signature, validator);
  }
  return validator;
}

function slotsOf(variables) {
  if (!Array.isArray(variables)) return [];
  return variables
    .filter((slot) => typeof slot?.key === 'string' && slot.key)
    .slice(0, VARIABLE_LIMITS.maxText)
    .map((slot) => ({
      key: slot.key,
      maxLength: Math.min(
        Math.max(Number(slot.maxLength) || VARIABLE_LIMITS.maxLength.default, VARIABLE_LIMITS.maxLength.min),
        VARIABLE_LIMITS.maxLength.max
      ),
    }));
}

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
 * Clean, sanitize and truncate entire poster content object.
 * `variables` are the blanks the chosen template offers; only those keys are kept.
 */
export function sanitizeAndTruncateContent(raw, variables = []) {
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

  const content = {
    title,
    tagline,
    date,
    time,
    venue,
    details,
    imageQuery,
  };

  const slots = slotsOf(variables);
  if (slots.length) {
    const source = raw.extras && typeof raw.extras === 'object' ? raw.extras : {};
    const extras = {};
    for (const slot of slots) {
      /* A blank the user's text did not answer stays empty. */
      extras[slot.key] = truncateAtWordBoundary(sanitizeString(source[slot.key]), slot.maxLength);
    }
    content.extras = extras;
  }

  return content;
}

/**
 * Validate object against the poster content schema. Pass the template's blanks to also
 * insist that the filled-in words are only the keys that template offers.
 */
export function validatePosterContent(data, variables = []) {
  const slots = slotsOf(variables);
  const validator = slots.length ? validatorFor(slots) : validateCompiled;
  const valid = validator(data);
  return {
    valid: Boolean(valid),
    errors: validator.errors || null,
  };
}
