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
    images: { type: 'object', additionalProperties: { type: 'string' } },
    photographer: { type: 'string', maxLength: 100 },
    photographerUrl: { type: 'string' },
    downloadLocation: { type: 'string' },
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
 * Trim text to a maximum number of words
 */
export function trimToWords(text, maxWords = 6) {
  if (!text) return '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
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
    archetype: { type: 'string', enum: recipeIds() },
    variant: { type: 'integer', minimum: 0, maximum: RECIPE_VARIANTS.length - 1 },
    fields: {
      type: 'object',
      properties: {
        kicker: shortText(40),
        title: shortText(60),
        subtitle: shortText(100),
        bullets: {
          type: 'array',
          maxItems: 3,
          items: shortText(70),
        },
        date: shortText(30),
        time: shortText(20),
        venue: shortText(80),
        cta: shortText(40),
        photoKeywords: shortText(60),
      },
      required: ['kicker', 'title', 'subtitle', 'bullets', 'date', 'time', 'venue', 'cta', 'photoKeywords'],
      additionalProperties: false,
    },
  },
  required: ['archetype', 'variant', 'fields'],
  additionalProperties: false,
};

const validateDesignCompiled = ajv.compile(designJsonSchema);

export const CATEGORY_ARCHETYPES = {
  sports: ['date-block', 'bold-type'],
  awards: ['centered-award'],
  workshop: ['agenda'],
  seminar: ['agenda'],
  festival: ['ticket', 'photo-hero'],
  market: ['ticket', 'photo-hero'],
  health: ['photo-hero', 'split-color'],
  camp: ['photo-hero', 'split-color'],
  awareness: ['photo-hero', 'split-color'],
  notice: ['notice'],
  closure: ['notice'],
};

export function matchCategoryFromText(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(?:sports?|marathon|tournament|cricket|football|athletic|race|relay)\b/i.test(lower)) {
    return 'sports';
  }
  if (/\b(?:awards?|honour|honor|recognition|gala)\b/i.test(lower)) {
    return 'awards';
  }
  if (/\b(?:workshop|seminar|masterclass|bootcamp|training|webinar)\b/i.test(lower)) {
    return 'workshop';
  }
  if (/\b(?:festival|market|fest|fair|carnival|diwali|deepavali|pongal|harvest)\b/i.test(lower)) {
    return 'festival';
  }
  if (/\b(?:health|camp|awareness|blood|donation|clinic|medical|tree|cleanliness|drive)\b/i.test(lower)) {
    return 'health';
  }
  if (/\b(?:notice|closure|closed|maintenance|announcement)\b/i.test(lower)) {
    return 'notice';
  }
  return null;
}

export function preferredArchetypesFor(text) {
  const cat = matchCategoryFromText(text);
  if (cat && CATEGORY_ARCHETYPES[cat]) {
    return CATEGORY_ARCHETYPES[cat];
  }
  return recipeIds();
}

export function hashSeed(str) {
  let hash = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function selectArchetypeAndVariant({
  text = '',
  avoidRecipeIds = [],
  variant = null,
  instruction = '',
  seed = null,
} = {}) {
  const preferred = preferredArchetypesFor(text);
  const forcedVariant =
    variant !== null && variant !== undefined && RECIPE_VARIANTS.includes(Number(variant))
      ? Number(variant)
      : null;

  const allPairs = [];
  if (forcedVariant !== null) {
    for (const arch of preferred) {
      allPairs.push({ archetype: arch, variant: forcedVariant });
    }
  } else {
    for (let v = 0; v < RECIPE_VARIANTS.length; v++) {
      for (const arch of preferred) {
        allPairs.push({ archetype: arch, variant: v });
      }
    }
  }

  const seedString = `${text}|${instruction || ''}|${seed ?? ''}`;
  const baseSeed = hashSeed(seedString);

  const avoids = (Array.isArray(avoidRecipeIds) ? avoidRecipeIds : [avoidRecipeIds].filter(Boolean))
    .map((id) => String(id).trim())
    .filter(Boolean);

  const avoidArchetypes = new Set();
  const avoidExactPairs = new Set();
  for (const item of avoids) {
    const parts = item.split(':');
    avoidArchetypes.add(parts[0].trim().toLowerCase());
    if (parts.length > 1) {
      avoidExactPairs.add(`${parts[0].trim().toLowerCase()}:${Number(parts[1])}`);
    } else {
      avoidExactPairs.add(`${parts[0].trim().toLowerCase()}:0`);
    }
  }

  // 1. First, avoid archetypes that have already been seen
  let available = allPairs.filter((p) => !avoidArchetypes.has(p.archetype.toLowerCase()));

  // 2. If all preferred archetypes were avoided (e.g. single-archetype category like awards, or user cycled through),
  // avoid the exact pairs already seen
  if (available.length === 0) {
    available = allPairs.filter((p) => !avoidExactPairs.has(`${p.archetype.toLowerCase()}:${p.variant}`));
  }

  // 3. If all pairs were exhausted, fall back to all pairs
  if (available.length === 0) {
    available = allPairs;
  }

  // If instruction indicates regeneration or avoids exist, advance index so it never repeats the previous
  const isRegen = instruction && /regen/i.test(instruction);
  const offset = (avoids.length > 0 || isRegen) ? Math.max(1, avoids.length) : 0;
  const pickIndex = (baseSeed + offset) % available.length;
  return available[pickIndex] || allPairs[0];
}

export function resolveArchetype(givenArchetype, promptText = '') {
  const allowed = recipeIds();
  const clean = typeof givenArchetype === 'string' ? givenArchetype.trim().toLowerCase() : '';
  const match = allowed.find((id) => id.toLowerCase() === clean);
  if (match) return match;
  return selectArchetypeAndVariant({ text: promptText }).archetype;
}

export function stripInstructionWords(phrase) {
  let s = String(phrase || '').trim();
  s = s.replace(/^(?:please\s+)?(?:be\s+sure\s+to\s+)?(?:include|including|add|make|create|featuring|with|have)\s+/i, '');
  if (/^registration\s+desk\b/i.test(s) && !/on\s+site|open|at/i.test(s)) {
    s = 'Registration desk on site';
  } else if (/^medals\b/i.test(s) && !/for|to/i.test(s)) {
    s = 'Medals for every winner';
  }
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Clean one design answer: HTML stripped, every line cut at a word boundary, a design that
 * is unknown or avoided exchanged for the first allowed one.
 */
export function sanitizeAndTruncateDesign(raw, { avoidRecipeIds = [], variant = null, prompt = '', instruction = '' } = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const isFieldsFormat = Boolean(raw.fields || raw.archetype);
  const rawFields = raw.fields && typeof raw.fields === 'object' ? raw.fields : {};

  const givenArchetype = raw.archetype || raw.recipeId;
  const allowed = recipeIds();
  const cleanGiven = typeof givenArchetype === 'string' ? givenArchetype.trim().toLowerCase() : '';
  const isRegistryMatch = allowed.some((id) => id.toLowerCase() === cleanGiven);

  let archetype;
  let cleanVariant;

  if (isRegistryMatch) {
    archetype = allowed.find((id) => id.toLowerCase() === cleanGiven);
    let forcedVariant = variant;
    if (forcedVariant === null || forcedVariant === undefined) {
      forcedVariant = raw.variant;
    }
    cleanVariant = RECIPE_VARIANTS.includes(Number(forcedVariant)) ? Number(forcedVariant) : 0;

    // Check if this pair is in avoidRecipeIds; if so, pick an alternative pair
    const avoids = (Array.isArray(avoidRecipeIds) ? avoidRecipeIds : [avoidRecipeIds].filter(Boolean))
      .map((id) => String(id).trim().toLowerCase());
    const isAvoided = avoids.includes(archetype.toLowerCase()) || avoids.includes(`${archetype.toLowerCase()}:${cleanVariant}`);
    if (isAvoided) {
      const alt = selectArchetypeAndVariant({ text: prompt, avoidRecipeIds, variant, instruction });
      archetype = alt.archetype;
      cleanVariant = alt.variant;
    }
  } else {
    // If invalid archetype, fall back to keyword match and seeded selection
    const fallbackSelection = selectArchetypeAndVariant({ text: prompt, avoidRecipeIds, variant, instruction });
    archetype = fallbackSelection.archetype;
    cleanVariant = fallbackSelection.variant;
  }

  const kicker = isFieldsFormat ? rawFields.kicker : raw.title?.sub;
  const title = isFieldsFormat ? rawFields.title : (raw.title?.main || raw.title);
  const subtitle = isFieldsFormat ? rawFields.subtitle : raw.tagline;
  const bullets = isFieldsFormat ? rawFields.bullets : raw.bullets;
  const date = isFieldsFormat ? rawFields.date : raw.info?.date;
  const time = isFieldsFormat ? rawFields.time : raw.info?.time;
  const venue = isFieldsFormat ? rawFields.venue : raw.info?.venue;
  const cta = isFieldsFormat ? rawFields.cta : (raw.cta?.button || raw.cta?.line);
  const photoKeywords = isFieldsFormat ? rawFields.photoKeywords : raw.imageQuery;

  const kickerClean = trimToWords(stripInstructionWords(sanitizeString(kicker)), 4);
  const titleClean = truncateAtWordBoundary(sanitizeString(title), 60);
  const subtitleClean = trimToWords(sanitizeString(subtitle), 10);
  const bulletsClean = (Array.isArray(bullets) ? bullets : [])
    .slice(0, 3)
    .map((b) => trimToWords(stripInstructionWords(sanitizeString(b)), 6))
    .filter((b) => b.length > 0);

  const dateClean = truncateAtWordBoundary(sanitizeString(date), 30);
  const timeClean = truncateAtWordBoundary(sanitizeString(time), 20);
  let venueClean = sanitizeString(venue);
  if (!venueClean || /no\s+venue/i.test(venueClean)) {
    venueClean = 'Venue to be announced';
  } else {
    venueClean = truncateAtWordBoundary(venueClean, 80);
  }

  let ctaClean = sanitizeString(typeof cta === 'object' ? (cta.button || cta.line) : cta);
  if (!ctaClean || /^(?:join\s+us|come\s+celebrate|find\s+out\s+more|click\s+here)\b/i.test(ctaClean)) {
    ctaClean = 'Open to all';
  } else {
    ctaClean = truncateAtWordBoundary(ctaClean, 40);
  }

  const photoKeywordsClean = trimToWords(sanitizeString(photoKeywords), 4);

  const fields = {
    kicker: kickerClean,
    title: titleClean,
    subtitle: subtitleClean,
    bullets: bulletsClean,
    date: dateClean,
    time: timeClean,
    venue: venueClean,
    cta: ctaClean,
    photoKeywords: photoKeywordsClean,
  };

  const words = [titleClean, subtitleClean, photoKeywordsClean, venueClean].filter(Boolean).join(' ');
  const icon = normalizeIconName(sanitizeString(raw.icon)) || iconForWords(words);

  const result = {
    archetype,
    variant: cleanVariant,
    fields,
  };

  // Compatibility helpers for consumers expecting legacy fields or icon
  Object.defineProperties(result, {
    recipeId: { get() { return this.archetype; }, enumerable: false, configurable: true },
    icon: { value: icon, writable: true, enumerable: false, configurable: true },
    title: { get() { return { main: this.fields.title, sub: this.fields.kicker }; }, enumerable: false, configurable: true },
    tagline: { get() { return this.fields.subtitle; }, enumerable: false, configurable: true },
    slogan: { get() { return { line1: '', line2: '' }; }, enumerable: false, configurable: true },
    bullets: { get() { return this.fields.bullets; }, enumerable: false, configurable: true },
    info: { get() { return { date: this.fields.date, time: this.fields.time, venue: this.fields.venue }; }, enumerable: false, configurable: true },
    cta: { get() { return { line: this.fields.cta, button: this.fields.cta }; }, enumerable: false, configurable: true },
    imageQuery: { get() { return this.fields.photoKeywords; }, enumerable: false, configurable: true },
  });

  return result;
}

export function validateDesignAnswer(data) {
  if (!data || typeof data !== 'object') return { valid: false, errors: ['not an object'] };
  const valid = validateDesignCompiled(data);
  return {
    valid: Boolean(valid),
    errors: valid ? null : validateDesignCompiled.errors,
  };
}

/**
 * The words a design answer puts on the poster, in the shape the poster content already
 * uses.
 */
export function designToContent(design) {
  const source = design && typeof design === 'object' ? design : {};
  const fields = source.fields && typeof source.fields === 'object' ? source.fields : null;

  if (fields) {
    const extras = {};
    if (fields.kicker) {
      extras.title_sub = truncateAtWordBoundary(sanitizeString(fields.kicker), DESIGN_BLANKS.title_sub?.maxLength || 40);
    }
    if (fields.subtitle) {
      extras.slogan_1 = truncateAtWordBoundary(sanitizeString(fields.subtitle), DESIGN_BLANKS.slogan_1?.maxLength || 34);
    }
    if (fields.cta) {
      extras.cta_line = truncateAtWordBoundary(sanitizeString(fields.cta), DESIGN_BLANKS.cta_line?.maxLength || 48);
      extras.cta_button = truncateAtWordBoundary(sanitizeString(fields.cta), DESIGN_BLANKS.cta_button?.maxLength || 20);
    }
    return {
      title: truncateAtWordBoundary(sanitizeString(fields.title), 60),
      tagline: truncateAtWordBoundary(sanitizeString(fields.subtitle), 100),
      date: truncateAtWordBoundary(sanitizeString(fields.date), 30),
      time: truncateAtWordBoundary(sanitizeString(fields.time), 20),
      venue: truncateAtWordBoundary(sanitizeString(fields.venue), 80) || 'Venue to be announced',
      details: (Array.isArray(fields.bullets) ? fields.bullets : [])
        .slice(0, 3)
        .map((line) => trimToWords(truncateAtWordBoundary(sanitizeString(line), 90), 6))
        .filter((line) => line.length > 0),
      imageQuery: truncateAtWordBoundary(sanitizeString(fields.photoKeywords), 60),
      extras,
    };
  }

  const room = (key, value) =>
    truncateAtWordBoundary(sanitizeString(value), DESIGN_BLANKS[key]?.maxLength || 40);
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
    title: truncateAtWordBoundary(sanitizeString(source.title?.main || source.title), 60),
    tagline: truncateAtWordBoundary(sanitizeString(source.tagline), 100),
    date: truncateAtWordBoundary(sanitizeString(source.info?.date || source.date), 30),
    time: truncateAtWordBoundary(sanitizeString(source.info?.time || source.time), 20),
    venue: truncateAtWordBoundary(sanitizeString(source.info?.venue || source.venue), 80) || 'Venue to be announced',
    details: (Array.isArray(source.bullets || source.details) ? (source.bullets || source.details) : [])
      .slice(0, 3)
      .map((line) => trimToWords(truncateAtWordBoundary(sanitizeString(line), 90), 6))
      .filter((line) => line.length > 0),
    imageQuery: truncateAtWordBoundary(sanitizeString(source.imageQuery), 60),
    extras,
  };
}
