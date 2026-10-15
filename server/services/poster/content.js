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

/** Storage folders are split organization by organization, so the owner is readable. */
const TENANT_FOLDER = /(?:brand|posters|tenants)\/([0-9a-f]{24})(?:\/|$)/i;

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
  let elements = [];
  if (design?.sections?.content?.elements && Array.isArray(design.sections.content.elements)) {
    elements = design.sections.content.elements;
  } else if (design?.template?.sections?.content?.elements && Array.isArray(design.template.sections.content.elements)) {
    elements = design.template.sections.content.elements;
  } else if (Array.isArray(design?.elements)) {
    elements = design.elements;
  } else {
    elements = elementsOfDesign(design);
  }
  return {
    elements: (elements || []).filter((el) => el?.section !== 'header' && el?.section !== 'footer'),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    clientId: clientId ? String(clientId) : '',
  };
}

function plainish(value) {
  if (value == null) return value;
  return typeof value.toObject === 'function' ? value.toObject() : value;
}

const VALID_CONTENT_KEYS = new Set([
  'title',
  'tagline',
  'date',
  'time',
  'venue',
  'details',
  'imageUrl',
  'image',
  'extras',
  'images',
  'lists',
  'photographer',
  'photographerUrl',
  'downloadLocation',
  'isAiGenerated',
]);

export function normalizePosterContent(raw, valuesContext = null) {
  if (!raw || typeof raw !== 'object') throw reject('Poster content is required');

  const unknownKey = Object.keys(raw).find((k) => !VALID_CONTENT_KEYS.has(k));
  if (unknownKey) {
    const validNames = ['title', 'tagline', 'date', 'time', 'venue', 'details', 'imageUrl', 'extras', 'images', 'lists'];
    throw reject(`"${unknownKey}" is not a field this poster offers. Valid fields: ${validNames.join(', ')}.`);
  }

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
    imageUrl: normalizeImageUrl(raw.imageUrl !== undefined ? raw.imageUrl : raw.image, 'imageUrl', context.clientId),
  };
  if (values.extras) content.extras = values.extras;
  if (values.images) content.images = values.images;
  if (values.lists) content.lists = values.lists;
  return content;
}

/**
 * Maps filled-in blank answers from an old design snapshot to a target design snapshot:
 * 1. By exact key match
 * 2. By slot label match
 * 3. By slot position match
 * Unmatched answers are dropped and counted so callers can inform the user.
 */
export function remapContentToDesign(content, sourceDesign, targetDesign) {
  const plainSource = plainish(sourceDesign);
  const plainTarget = plainish(targetDesign);
  const oldSlots = variableSlotsOf(elementsOfDesign(plainSource));
  const newSlots = variableSlotsOf(elementsOfDesign(plainTarget));

  const oldExtras = content?.extras && typeof content.extras === 'object' ? content.extras : {};
  const newExtras = {};
  const usedNewTextKeys = new Set();
  const mappedTextKeys = new Set();
  const droppedTexts = [];

  const oldExtraEntries = Object.entries(oldExtras);

  // 1. Exact key match for texts
  for (const [key, val] of oldExtraEntries) {
    const match = newSlots.texts.find((s) => s.key === key && !usedNewTextKeys.has(s.key));
    if (match) {
      newExtras[key] = val;
      usedNewTextKeys.add(key);
      mappedTextKeys.add(key);
    }
  }

  // 2. Label match for texts
  for (const [key, val] of oldExtraEntries) {
    if (mappedTextKeys.has(key)) continue;
    const oldSlot = oldSlots.texts.find((s) => s.key === key);
    if (oldSlot?.label) {
      const match = newSlots.texts.find(
        (s) => s.label && s.label.toLowerCase() === oldSlot.label.toLowerCase() && !usedNewTextKeys.has(s.key)
      );
      if (match) {
        newExtras[match.key] = val;
        usedNewTextKeys.add(match.key);
        mappedTextKeys.add(key);
      }
    }
  }

  // 3. Position match for texts
  for (const [key, val] of oldExtraEntries) {
    if (mappedTextKeys.has(key)) continue;
    let pos = oldSlots.texts.findIndex((s) => s.key === key);
    if (pos < 0) {
      pos = oldExtraEntries.findIndex(([k]) => k === key);
    }
    if (pos >= 0 && pos < newSlots.texts.length && !usedNewTextKeys.has(newSlots.texts[pos].key)) {
      const targetSlot = newSlots.texts[pos];
      newExtras[targetSlot.key] = val;
      usedNewTextKeys.add(targetSlot.key);
      mappedTextKeys.add(key);
    } else {
      droppedTexts.push(key);
    }
  }

  const oldImages = content?.images && typeof content.images === 'object' ? content.images : {};
  const newImages = {};
  const usedNewImageKeys = new Set();
  const mappedImageKeys = new Set();
  const droppedImages = [];

  const oldImageEntries = Object.entries(oldImages);

  // 1. Exact key match for images
  for (const [key, val] of oldImageEntries) {
    const match = newSlots.images.find((s) => s.key === key && !usedNewImageKeys.has(s.key));
    if (match) {
      newImages[key] = val;
      usedNewImageKeys.add(key);
      mappedImageKeys.add(key);
    }
  }

  // 2. Label match for images
  for (const [key, val] of oldImageEntries) {
    if (mappedImageKeys.has(key)) continue;
    const oldSlot = oldSlots.images.find((s) => s.key === key);
    if (oldSlot?.label) {
      const match = newSlots.images.find(
        (s) => s.label && s.label.toLowerCase() === oldSlot.label.toLowerCase() && !usedNewImageKeys.has(s.key)
      );
      if (match) {
        newImages[match.key] = val;
        usedNewImageKeys.add(match.key);
        mappedImageKeys.add(key);
      }
    }
  }

  // 3. Position match for images
  for (const [key, val] of oldImageEntries) {
    if (mappedImageKeys.has(key)) continue;
    let pos = oldSlots.images.findIndex((s) => s.key === key);
    if (pos < 0) {
      pos = oldImageEntries.findIndex(([k]) => k === key);
    }
    if (pos >= 0 && pos < newSlots.images.length && !usedNewImageKeys.has(newSlots.images[pos].key)) {
      const targetSlot = newSlots.images[pos];
      newImages[targetSlot.key] = val;
      usedNewImageKeys.add(targetSlot.key);
      mappedImageKeys.add(key);
    } else {
      droppedImages.push(key);
    }
  }

  const oldLists = content?.lists && typeof content.lists === 'object' ? content.lists : {};
  const newLists = {};
  const droppedLists = [];
  const cardLists = newSlots.cardLists || [];
  for (const [key, val] of Object.entries(oldLists)) {
    if (cardLists.some((cl) => cl.key === key)) {
      newLists[key] = val;
    } else {
      droppedLists.push(key);
    }
  }

  const droppedCount = droppedTexts.length + droppedImages.length + droppedLists.length;
  const remapped = {
    ...(content || {}),
    extras: Object.keys(newExtras).length ? newExtras : undefined,
    images: Object.keys(newImages).length ? newImages : undefined,
    lists: Object.keys(newLists).length ? newLists : undefined,
  };

  return {
    content: remapped,
    droppedCount,
    droppedKeys: [...droppedTexts, ...droppedImages, ...droppedLists],
  };
}
