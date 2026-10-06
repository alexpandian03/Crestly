/**
 * Template editor items on the server.
 *
 * The rules themselves live in /shared/templateElements.js so the browser can use the very
 * same file; this module only ties them to the request (whose tenant, which brand bands,
 * which poster size) and turns a failure into a plain 400.
 */
import {
  EDITOR_VERSION,
  LEGACY_EDITOR_VERSION,
  TEMPLATE_DOC_MAX_BYTES,
  contentArea,
  jsonBytes,
  legacyToElements,
  normalizeElements,
  templateSizeOf,
} from '../../../shared/templateElements.js';
import { templateElementsSchema } from '../../validation/template.schema.js';
import { badRequest } from './zones.js';

function plain(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
}

const GENERIC_ITEMS_MESSAGE = 'Some items on this template are no longer allowed. Reload it and try again.';

/**
 * Everything the item rules need to know about this request: the tenant's own photo folder,
 * the brand bands and the poster size that decide where an item may sit.
 */
export function elementContext({ brandKit = null, template = null, clientId = null, size = null } = {}) {
  const posterSize = size || templateSizeOf(template);
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    clientId: clientId ? String(clientId) : null,
    brandKit: plain(brandKit),
    template: { size: posterSize },
    area: contentArea(plain(brandKit), { size: posterSize }),
  };
}

/**
 * The one shared check every template write runs: create, update, duplicate and restore.
 * Returns the items exactly as they will be stored.
 */
export function cleanElements(elements, context) {
  const parsed = templateElementsSchema(context).safeParse(plain(elements) ?? []);
  if (!parsed.success) {
    const issue = parsed.error?.issues?.[0];
    throw badRequest(issue?.message || GENERIC_ITEMS_MESSAGE);
  }
  return normalizeElements(parsed.data);
}

/** Items an old template does not have yet: converted from its areas, never written back. */
export function elementsForRead(template, brandKit) {
  const raw = plain(template) || {};
  const stored = Array.isArray(raw.elements) ? plain(raw.elements) : [];
  if (stored.length > 0) return normalizeElements(stored);
  return legacyToElements(raw, plain(brandKit));
}

/**
 * 2 once a template carries items of its own, 1 while it is still only areas. `fallback`
 * keeps an already-upgraded template upgraded when this write did not touch its items.
 */
export function editorVersionFor(elements, fallback = LEGACY_EDITOR_VERSION) {
  return Array.isArray(elements) && elements.length > 0 ? EDITOR_VERSION : fallback;
}

/** The editor version a stored template is on, for reads that must not rewrite anything. */
export function storedEditorVersion(template) {
  const raw = plain(template) || {};
  const stored = Array.isArray(raw.elements) ? raw.elements : [];
  return Number(raw.editorVersion) === EDITOR_VERSION || stored.length > 0
    ? EDITOR_VERSION
    : LEGACY_EDITOR_VERSION;
}

/** Keeps a template document (items plus its history) near the size the database can hold. */
export function assertTemplateDocSize(candidate) {
  if (jsonBytes(candidate) > TEMPLATE_DOC_MAX_BYTES) {
    throw badRequest('This template is too big to save. Remove a few items and try again.');
  }
}
