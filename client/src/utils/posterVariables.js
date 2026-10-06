import {
  VARIABLE_LIMITS,
  checkContentImageUrl,
  elementsOfDesign,
  jsonBytes,
  plainText,
  variableSlotsOf,
} from '../../../shared/templateElements.js';

/**
 * A poster's fill-in blanks come from the design the poster was made with, not from the live
 * template, so everything here reads `poster.design.template.elements`. The answers live in
 * `content.extras` (words) and `content.images` (pictures), both keyed by the blank's own name.
 */

export const BLANK_MESSAGES = {
  tooLong: (label, max) => `${label} cannot be longer than ${max} characters.`,
  overBudget: 'There is too much to fill in on one poster. Please shorten the words.',
  foreignPhoto: 'That photo is not from your organization. Choose one of your own pictures.',
  uploadNeedsAdmin: 'An administrator can put a new picture here. To change it now, pick one that is ready.',
  noPicture: 'No other picture is ready for this poster yet.',
  emptyHint: 'Leave it empty and the poster keeps the words the designer wrote in the box.',
};

/** The room one blank was given, always a whole number the field can enforce. */
export function blankLimitOf(slot) {
  const max = Number(slot?.maxLength);
  if (!Number.isFinite(max)) return VARIABLE_LIMITS.maxLength.default;
  return Math.min(VARIABLE_LIMITS.maxLength.max, Math.max(VARIABLE_LIMITS.maxLength.min, Math.round(max)));
}

/**
 * The items to read blanks from. A poster's own design snapshot answers first; a plain
 * template is accepted too, so a poster that has not been saved yet can show its spaces.
 */
function itemsOf(design) {
  const fromDesign = elementsOfDesign(design);
  if (fromDesign.length) return fromDesign;
  return Array.isArray(design?.elements) ? design.elements : [];
}

/** The blanks of one poster's own design: `{ texts, images }`, in the order they are placed. */
export function blanksOfDesign(design) {
  const elements = itemsOf(design);
  const slots = variableSlotsOf(elements);
  /* What the designer left in the box, so an empty answer still shows a real hint. */
  const left = (id, name) => {
    const item = (Array.isArray(elements) ? elements : []).find((each) => String(each?.id) === String(id));
    return String(item?.[name] || '').trim();
  };
  return {
    texts: slots.texts.map((slot) => ({
      ...slot,
      maxLength: blankLimitOf(slot),
      placeholder: left(slot.id, 'text'),
    })),
    images: slots.images.map((slot) => ({ ...slot, placeholder: left(slot.id, 'imageUrl') })),
  };
}

export function blankTextKeys(design) {
  return blanksOfDesign(design).texts.map((slot) => slot.key);
}

export function hasBlanks(design) {
  const slots = blanksOfDesign(design);
  return slots.texts.length > 0 || slots.images.length > 0;
}

/** One blank's name as it is shown to a person. */
export function blankLabel(slot) {
  return plainText(slot?.label || slot?.key || '', VARIABLE_LIMITS.labelChars).trim() || 'Blank';
}

export function wordsOfBlank(content, key) {
  const value = plainish(content)?.extras?.[key];
  return typeof value === 'string' ? value : '';
}

export function imageOfBlank(content, key) {
  const value = plainish(content)?.images?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function plainish(value) {
  return value && typeof value === 'object' ? value : null;
}

function withoutEmpty(record) {
  const out = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    const words = typeof value === 'string' ? value.trim() : '';
    if (words) out[key] = words;
  });
  return out;
}

/**
 * One blank's words, put back on the poster's content. An empty answer removes the key, so the
 * poster falls back to the words the designer left in the box and nothing is stored for it.
 */
export function withBlankWords(content, key, words, maxLength) {
  const extras = { ...(plainish(content)?.extras || {}) };
  const value = plainText(words, Math.min(maxLength || VARIABLE_LIMITS.maxLength.max, VARIABLE_LIMITS.maxLength.max));
  if (value.trim()) extras[key] = value;
  else delete extras[key];
  return { ...(content || {}), extras: withoutEmpty(extras) };
}

export function withBlankImage(content, key, url) {
  const images = { ...(plainish(content)?.images || {}) };
  const value = typeof url === 'string' ? url.trim().slice(0, 600) : '';
  if (value) images[key] = value;
  else delete images[key];
  return { ...(content || {}), images: withoutEmpty(images) };
}

/** The two answer sets as they should go to the API: absent when there is nothing to store. */
export function blankPayloadOf(content) {
  const extras = withoutEmpty(plainish(content)?.extras);
  const images = withoutEmpty(plainish(content)?.images);
  return {
    extras: Object.keys(extras).length ? extras : undefined,
    images: Object.keys(images).length ? images : undefined,
  };
}

export function blankAnswersProblem(content, design) {
  const slots = blanksOfDesign(design);
  const answers = plainish(content)?.extras || {};
  for (const slot of slots.texts) {
    const words = typeof answers[slot.key] === 'string' ? answers[slot.key] : '';
    if (words.length > blankLimitOf(slot)) {
      return BLANK_MESSAGES.tooLong(blankLabel(slot), blankLimitOf(slot));
    }
  }
  const pictures = plainish(content)?.images || {};
  for (const slot of slots.images) {
    const value = typeof pictures[slot.key] === 'string' ? pictures[slot.key].trim() : '';
    if (!value) continue;
    const check = checkContentImageUrl(value, {});
    if (!check.ok) return `${blankLabel(slot)}: ${check.reason}`;
  }
  const filled = blankPayloadOf(content);
  if (filled.extras || filled.images) {
    if (jsonBytes({ extras: filled.extras || {}, images: filled.images || {} }) > VARIABLE_LIMITS.valuesTotalBytes) {
      return BLANK_MESSAGES.overBudget;
    }
  }
  return '';
}

/**
 * A picture chosen for a blank must be one this client may use. The cloud name is never known in
 * the browser, so the folder rule is the one that can be checked here and the rest is the
 * server's answer on save.
 */
export function blankImageProblem(url) {
  const value = typeof url === 'string' ? url.trim() : '';
  if (!value) return '';
  const check = checkContentImageUrl(value, {});
  return check.ok ? '' : BLANK_MESSAGES.foreignPhoto;
}

/**
 * The assistant writes the words again, but a person's own answers stay: every picture they put
 * in, and every blank they typed by hand and did not let the assistant rewrite.
 */
export function mergeGeneratedBlanks(nextContent, previousContent, editedKeys) {
  const next = nextContent || {};
  const previous = previousContent || {};
  const held = new Set(Array.isArray(editedKeys) ? editedKeys : []);
  const extras = { ...(next.extras || {}) };
  Object.entries(previous.extras || {}).forEach(([key, words]) => {
    if (held.has(key) && String(words || '').trim()) extras[key] = String(words);
  });
  return {
    ...next,
    extras: withoutEmpty(extras),
    images: { ...(next.images || {}), ...(previous.images || {}) },
  };
}

/** Only an account that may sign an upload can put a new picture in a blank. */
export function canUploadBlankImage(user) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'superadmin' || role === 'clientadmin';
}

/** A picture put into a blank: this device, no bigger than 2 MB, shrunk before it is sent. */
export const BLANK_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const BLANK_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function checkBlankImageFile(file) {
  if (!file) return 'Choose a picture first.';
  if (!BLANK_IMAGE_TYPES.includes(file.type)) {
    return `That is a ${file.type || 'unknown'} file. Please choose a JPG, PNG or WebP picture.`;
  }
  if (file.size > BLANK_IMAGE_MAX_BYTES) {
    return `That picture is ${megabytes(file.size)}. Please choose one under 2 MB, or use a smaller one.`;
  }
  if (!file.size) return 'That picture appears to be empty. Please choose another one.';
  return '';
}

function megabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { VARIABLE_LIMITS };
