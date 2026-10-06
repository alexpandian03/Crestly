import Ajv from 'ajv';
import {
  ICON_NAMES,
  VARIABLE_LIMITS,
  iconForWords,
  normalizeIconName,
} from '../../../shared/templateElements.js';
import {
  DESIGN_BLANKS,
  DESIGN_RECIPES,
  RECIPE_VARIANTS,
  recipeIds,
} from '../../../shared/designRecipes.js';

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

/* ------------------------------------------------------------------------- *
 * The design answer (mode "ai"): the model names one recipe and writes only
 * the words that go on the poster. No colours, no coordinates - the recipe
 * places those from the brand kit itself.
 * ------------------------------------------------------------------------- */

/** What the model may return, in characters. */
export const DESIGN_ANSWER_LIMITS = {
  main: 24,
  sub: 40,
  tagline: 60,
  sloganLine1: 40,
  sloganLine2: 60,
  bullet: 70,
  maxBullets: 3,
  date: 30,
  time: 20,
  venue: 80,
  ctaLine: 40,
  ctaButton: 30,
  imageQuery: 60,
};

const shortText = (max) => ({ type: 'string', maxLength: max });

export const designJsonSchema = {
  type: 'object',
  properties: {
    recipeId: { type: 'string', enum: recipeIds() },
    variant: { type: 'integer', minimum: 0, maximum: RECIPE_VARIANTS.length - 1 },
    title: {
      type: 'object',
      properties: { main: shortText(DESIGN_ANSWER_LIMITS.main), sub: shortText(DESIGN_ANSWER_LIMITS.sub) },
      required: ['main', 'sub'],
      additionalProperties: false,
    },
    tagline: shortText(DESIGN_ANSWER_LIMITS.tagline),
    slogan: {
      type: 'object',
      properties: {
        line1: shortText(DESIGN_ANSWER_LIMITS.sloganLine1),
        line2: shortText(DESIGN_ANSWER_LIMITS.sloganLine2),
      },
      required: ['line1', 'line2'],
      additionalProperties: false,
    },
    bullets: {
      type: 'array',
      maxItems: DESIGN_ANSWER_LIMITS.maxBullets,
      items: shortText(DESIGN_ANSWER_LIMITS.bullet),
    },
    info: {
      type: 'object',
      properties: {
        date: shortText(DESIGN_ANSWER_LIMITS.date),
        time: shortText(DESIGN_ANSWER_LIMITS.time),
        venue: shortText(DESIGN_ANSWER_LIMITS.venue),
      },
      required: ['date', 'time', 'venue'],
      additionalProperties: false,
    },
    cta: {
      type: 'object',
      properties: {
        line: shortText(DESIGN_ANSWER_LIMITS.ctaLine),
        button: shortText(DESIGN_ANSWER_LIMITS.ctaButton),
      },
      required: ['line', 'button'],
      additionalProperties: false,
    },
    icon: { type: 'string', enum: ICON_NAMES },
    imageQuery: shortText(DESIGN_ANSWER_LIMITS.imageQuery),
  },
  required: ['recipeId', 'variant', 'title', 'tagline', 'slogan', 'bullets', 'info', 'cta', 'icon', 'imageQuery'],
  additionalProperties: false,
};

const validateDesignCompiled = ajv.compile(designJsonSchema);

/** The designs this run may use; an avoided id never comes back. */
function pickRecipeId(value, allowed, avoided) {
  const wanted = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const named = allowed.find((id) => id.toLowerCase() === wanted);
  if (named && !avoided.includes(named)) return named;
  return allowed.find((id) => !avoided.includes(id)) || allowed[0] || 'hero';
}

function pickVariant(value, forced) {
  if (forced !== null && forced !== undefined && RECIPE_VARIANTS.includes(Number(forced))) {
    return Number(forced);
  }
  return RECIPE_VARIANTS.includes(Number(value)) ? Number(value) : 0;
}

/**
 * Clean one design answer: HTML stripped, every line cut at a word boundary, a design that
 * is unknown or avoided exchanged for the first allowed one. The shape is always complete,
 * so what comes out is what the recipe gets.
 */
export function sanitizeAndTruncateDesign(raw, { avoidRecipeIds = [], variant = null } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const L = DESIGN_ANSWER_LIMITS;
  const allowed = recipeIds();
  const avoided = (Array.isArray(avoidRecipeIds) ? avoidRecipeIds : [])
    .map((id) => String(id).trim())
    .filter((id) => allowed.includes(id));

  const part = (value, max) => truncateAtWordBoundary(sanitizeString(value), max);
  const object = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

  const title = object(raw.title);
  const slogan = object(raw.slogan);
  const info = object(raw.info);
  const cta = object(raw.cta);
  /* An assistant that names a mark this app cannot draw is not left with a plain star: the words
     of its own design say what the event is, so an awards night still gets a trophy. */
  const spoken = [title.main, title.sub, raw.tagline, raw.imageQuery].filter(Boolean).join(' ');

  return {
    recipeId: pickRecipeId(raw.recipeId, allowed, avoided),
    variant: pickVariant(raw.variant, variant),
    title: { main: part(title.main, L.main), sub: part(title.sub, L.sub) },
    tagline: part(raw.tagline, L.tagline),
    slogan: { line1: part(slogan.line1, L.sloganLine1), line2: part(slogan.line2, L.sloganLine2) },
    bullets: (Array.isArray(raw.bullets) ? raw.bullets : [])
      .slice(0, L.maxBullets)
      .map((line) => part(line, L.bullet))
      .filter((line) => line.length > 0),
    info: { date: part(info.date, L.date), time: part(info.time, L.time), venue: part(info.venue, L.venue) },
    cta: { line: part(cta.line, L.ctaLine), button: part(cta.button, L.ctaButton) },
    icon: normalizeIconName(sanitizeString(raw.icon)) || iconForWords(spoken),
    imageQuery: part(raw.imageQuery, L.imageQuery),
  };
}

export function validateDesignAnswer(data) {
  const valid = validateDesignCompiled(data);
  return {
    valid: Boolean(valid),
    errors: valid ? null : validateDesignCompiled.errors,
  };
}

/**
 * The words a design answer puts on the poster, in the shape the poster content already
 * uses. Each fill-in line is cut to the room that line has on the poster, so the stored
 * answers always fit the blanks the recipe offered.
 */
export function designToContent(design) {
  const source = design && typeof design === 'object' ? design : {};
  const room = (key, value) =>
    truncateAtWordBoundary(sanitizeString(value), DESIGN_BLANKS[key].maxLength);
  const extras = {};
  for (const key of Object.keys(DESIGN_BLANKS)) {
    const value =
      key === 'title_sub'
        ? source.title?.sub
        : key === 'slogan_1'
          ? source.slogan?.line1
          : key === 'slogan_2'
            ? source.slogan?.line2
            : key === 'cta_line'
              ? source.cta?.line
              : source.cta?.button;
    const words = room(key, value);
    if (words) extras[key] = words;
  }

  return {
    title: truncateAtWordBoundary(sanitizeString(source.title?.main), 60),
    tagline: truncateAtWordBoundary(sanitizeString(source.tagline), 100),
    date: truncateAtWordBoundary(sanitizeString(source.info?.date), 30),
    time: truncateAtWordBoundary(sanitizeString(source.info?.time), 20),
    venue: truncateAtWordBoundary(sanitizeString(source.info?.venue), 80),
    details: (Array.isArray(source.bullets) ? source.bullets : [])
      .slice(0, 4)
      .map((line) => truncateAtWordBoundary(sanitizeString(line), 90))
      .filter((line) => line.length > 0),
    imageQuery: truncateAtWordBoundary(sanitizeString(source.imageQuery), 60),
    extras,
  };
}
