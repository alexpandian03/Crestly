import Template, { getDefaultTemplateData } from '../models/Template.model.js';
import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import { scopedFilter } from '../middleware/auth.middleware.js';
import { sanitizeString } from '../services/ai/schema.js';
import {
  TEMPLATE_MAX_VERSIONS,
  assertZoneLayout,
  normalizeLayout,
  normalizeTemplateSize,
  normalizeZones,
} from '../services/template/zones.js';
import {
  assertTemplateDocSize,
  cleanElements,
  editorVersionFor,
  elementContext,
  elementsForRead,
  storedEditorVersion,
} from '../services/template/elements.js';

const LIST_FIELDS = 'clientId name category isActive isDefault version editorVersion updatedAt size layout zones';
const LIST_SORT = { isDefault: -1, createdAt: -1 };
const CONFLICT_MESSAGE = 'This template was changed somewhere else. Reload to continue.';

/* A template belongs to one organization, so no shared cache may hand it to another. */
const NO_STORE = 'no-store';

function notFound(res) {
  return res.status(404).json({
    success: false,
    error: { message: 'Template not found or inaccessible for this organization', status: 404 },
  });
}

function conflict(res) {
  return res.status(409).json({ success: false, error: { message: CONFLICT_MESSAGE, status: 409 } });
}

function duplicateName(res) {
  return res.status(409).json({
    success: false,
    error: {
      message: 'A template with that name already exists. Choose another name.',
      status: 409,
    },
  });
}

function sendBadRequest(message, res) {
  return res.status(400).json({ success: false, error: { message, status: 400 } });
}

function isDuplicateKey(err) {
  return err?.code === 11000;
}

/** Writers may touch every template of the tenant; plain users may only read active ones. */
function canSeeInactive(req) {
  return req.user.role !== 'user';
}

function readScope(req, extra = {}) {
  const filter = scopedFilter(req, extra);
  if (!canSeeInactive(req)) filter.isActive = true;
  return filter;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanName(value) {
  return sanitizeString(value || '').trim().slice(0, 120);
}

function plain(value) {
  if (!value) return {};
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
}

async function nameTaken(clientId, name, exceptId) {
  const filter = { clientId, name: new RegExp(`^${escapeRegex(name)}$`, 'i') };
  if (exceptId) filter._id = { $ne: exceptId };
  return Template.exists(filter);
}

/** "<name> copy", then "<name> copy 2", "<name> copy 3"… so duplicates never clash. */
async function copyNameFor(clientId, name) {
  const base = cleanName(name).slice(0, 110) || 'Template';
  for (let index = 1; index <= 20; index += 1) {
    const candidate = index === 1 ? `${base} copy` : `${base} copy ${index}`;
    if (!(await nameTaken(clientId, candidate))) return candidate;
  }
  return null;
}

/** The tenant's brand decides where items may sit, so every write reads it first. */
async function brandKitFor(req) {
  return BrandKit.findOne(scopedFilter(req)).lean();
}

function snapshotOf(template, note, byUser) {
  const zones = normalizeZones(template.zones);
  return {
    version: template.version,
    name: template.name,
    zones,
    layout: normalizeLayout(plain(template.layout), zones),
    elements: plain(template.elements || []),
    editorVersion: storedEditorVersion(template),
    size: normalizeTemplateSize(template.size),
    note: sanitizeString(note || 'Edited').trim().slice(0, 120),
    createdBy: template.createdBy || byUser,
    createdAt: template.updatedAt || template.createdAt || new Date(),
  };
}

/**
 * Items are stored only after the one shared rule set has seen them, with the brand bands
 * and the poster size they will actually be drawn inside.
 */
function cleanItemsFor(req, elements, { brandKit, size }) {
  return cleanElements(elements, elementContext({ brandKit, clientId: req.clientId, size }));
}

export async function getTemplates(req, res, next) {
  try {
    const filter = readScope(req);
    let templates = await Template.find(filter).select(LIST_FIELDS).sort(LIST_SORT).lean();

    if (templates.length === 0 && canSeeInactive(req)) {
      const client = await Client.findById(req.clientId);
      try {
        await Template.create(getDefaultTemplateData(req.clientId, client?.name || 'Standard'));
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
      templates = await Template.find(filter).select(LIST_FIELDS).sort(LIST_SORT).lean();
    }

    return res.status(200).set('Cache-Control', NO_STORE).json({ success: true, data: { templates } });
  } catch (err) {
    return next(err);
  }
}

export async function getTemplateById(req, res, next) {
  try {
    const template = await Template.findOne(readScope(req, { _id: req.params.id })).select('-__v').lean();
    if (!template) return notFound(res);

    /* A template that predates the editor opens as items converted from its areas; nothing
       is written back until an admin saves. */
    const brandKit = await brandKitFor(req);
    return res.status(200).set('Cache-Control', NO_STORE).json({
      success: true,
      data: {
        template: {
          ...template,
          editorVersion: storedEditorVersion(template),
          elements: elementsForRead(template, brandKit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function createTemplate(req, res, next) {
  try {
    const name = cleanName(req.body.name);
    if (!name) return sendBadRequest('Give the template a name.', res);

    const zones = normalizeZones(req.body.zones);
    const size = normalizeTemplateSize(req.body.size);
    const layout = normalizeLayout(req.body.layout, zones);
    assertZoneLayout({ size, zones });

    const brandKit = await brandKitFor(req);
    const elements = req.body.elements
      ? cleanItemsFor(req, req.body.elements, { brandKit, size })
      : [];

    if (await nameTaken(req.clientId, name)) return duplicateName(res);

    const doc = {
      clientId: req.clientId,
      name,
      category: req.body.category || 'Event',
      size,
      zones,
      layout,
      elements,
      editorVersion: editorVersionFor(elements),
      version: 1,
      versions: [],
      isActive: true,
      isDefault: false,
      createdBy: req.user._id,
    };
    assertTemplateDocSize(doc);

    const template = await Template.create(doc);

    return res.status(201).json({ success: true, data: { template } });
  } catch (err) {
    if (isDuplicateKey(err)) return duplicateName(res);
    return next(err);
  }
}

export async function updateTemplate(req, res, next) {
  try {
    const template = await Template.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!template) return notFound(res);

    const expected = req.body.expectedVersion ?? template.version;
    if (expected !== template.version) return conflict(res);

    const zones = normalizeZones(req.body.zones ?? template.zones);
    const size = normalizeTemplateSize(req.body.size ?? template.size);
    const layout = normalizeLayout({ ...plain(template.layout), ...plain(req.body.layout) }, zones);
    assertZoneLayout({ size, zones });

    /* Items that were not sent keep their stored state: renaming a template must not
       re-measure what an admin already placed. */
    const brandKit = await brandKitFor(req);
    const elements =
      req.body.elements !== undefined
        ? cleanItemsFor(req, req.body.elements, { brandKit, size })
        : plain(template.elements || []);

    const changes = {
      zones,
      size,
      layout,
      elements,
      editorVersion: editorVersionFor(elements, storedEditorVersion(template)),
    };
    if (req.body.category !== undefined) changes.category = req.body.category;
    if (req.body.name !== undefined) {
      const name = cleanName(req.body.name);
      if (!name) return sendBadRequest('Give the template a name.', res);
      if (await nameTaken(req.clientId, name, template._id)) return duplicateName(res);
      changes.name = name;
    }

    const archived = snapshotOf(template, req.body.note, req.user._id);
    const versions = [...plain(template.versions || []), archived].slice(-TEMPLATE_MAX_VERSIONS);
    assertTemplateDocSize({ ...plain(template), ...changes, versions });

    const updated = await Template.findOneAndUpdate(
      scopedFilter(req, { _id: template._id, version: template.version }),
      {
        $push: {
          versions: { $each: [archived], $slice: -TEMPLATE_MAX_VERSIONS },
        },
        $set: { ...changes, version: template.version + 1 },
      },
      { new: true, runValidators: true }
    );

    if (!updated) return conflict(res);
    return res.status(200).json({ success: true, data: { template: updated } });
  } catch (err) {
    if (isDuplicateKey(err)) return duplicateName(res);
    return next(err);
  }
}

export async function duplicateTemplate(req, res, next) {
  try {
    const template = await Template.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!template) return notFound(res);

    const name = await copyNameFor(req.clientId, template.name);
    if (!name) {
      return sendBadRequest('This template has too many copies. Rename one of them first.', res);
    }

    const zones = normalizeZones(template.zones);
    const size = normalizeTemplateSize(template.size);
    const storedElements = plain(template.elements || []);
    const brandKit = await brandKitFor(req);
    const elements = storedElements.length
      ? cleanItemsFor(req, storedElements, { brandKit, size })
      : [];

    const copy = await Template.create({
      clientId: req.clientId,
      name,
      category: template.category,
      size,
      zones,
      layout: normalizeLayout(plain(template.layout), zones),
      elements,
      editorVersion: editorVersionFor(elements),
      version: 1,
      versions: [],
      isActive: false,
      isDefault: false,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: { template: copy } });
  } catch (err) {
    if (isDuplicateKey(err)) return duplicateName(res);
    return next(err);
  }
}

export async function activateTemplate(req, res, next) {
  try {
    const template = await Template.findOneAndUpdate(
      scopedFilter(req, { _id: req.params.id }),
      { $set: { isActive: true } },
      { new: true, runValidators: true }
    );
    if (!template) return notFound(res);
    return res.status(200).json({ success: true, data: { template } });
  } catch (err) {
    return next(err);
  }
}

export async function deactivateTemplate(req, res, next) {
  try {
    const template = await Template.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!template) return notFound(res);
    if (!template.isActive) {
      return res.status(200).json({ success: true, data: { template } });
    }

    const activeCount = await Template.countDocuments(scopedFilter(req, { isActive: true }));
    if (activeCount <= 1) {
      return sendBadRequest('Keep at least one active template.', res);
    }

    const updated = await Template.findOneAndUpdate(
      scopedFilter(req, { _id: template._id }),
      { $set: { isActive: false } },
      { new: true }
    );
    return res.status(200).json({ success: true, data: { template: updated } });
  } catch (err) {
    return next(err);
  }
}

/** Posters keep their own text and brand, so a deleted template only leaves the list. */
export async function deleteTemplate(req, res, next) {
  try {
    const template = await Template.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!template) return notFound(res);

    if (template.isActive) {
      return sendBadRequest('Turn this template off first, then you can delete it.', res);
    }

    await template.deleteOne();
    return res.status(200).json({ success: true, data: { deleted: true, id: String(template._id) } });
  } catch (err) {
    return next(err);
  }
}

export async function restoreTemplateVersion(req, res, next) {
  try {
    const template = await Template.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!template) return notFound(res);

    const wanted = req.body.version;
    const source = template.versions.find((version) => version.version === wanted);
    if (!source) {
      return sendBadRequest(`Version ${wanted} is no longer available for this template.`, res);
    }

    const zones = normalizeZones(source.zones);
    const size = normalizeTemplateSize(source.size);
    const layout = normalizeLayout(plain(source.layout), zones);
    assertZoneLayout({ size, zones });

    /* The items that version had, checked against today's brand bands before they come back. */
    const brandKit = await brandKitFor(req);
    const storedElements = plain(source.elements || []);
    const elements = storedElements.length
      ? cleanItemsFor(req, storedElements, { brandKit, size })
      : [];

    const archived = snapshotOf(template, `Restored version ${wanted}`, req.user._id);
    const changes = {
      ...(source.name ? { name: cleanName(source.name) } : {}),
      zones,
      size,
      layout,
      elements,
      editorVersion: editorVersionFor(elements),
    };
    const versions = [...plain(template.versions || []), archived].slice(-TEMPLATE_MAX_VERSIONS);
    assertTemplateDocSize({ ...plain(template), ...changes, versions });

    const updated = await Template.findOneAndUpdate(
      scopedFilter(req, { _id: template._id, version: template.version }),
      {
        $push: {
          versions: { $each: [archived], $slice: -TEMPLATE_MAX_VERSIONS },
        },
        $set: {
          ...changes,
          version: template.version + 1,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) return conflict(res);
    return res.status(200).json({ success: true, data: { template: updated } });
  } catch (err) {
    if (isDuplicateKey(err)) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Another template already uses the name from that version. Rename this template first.',
          status: 409,
        },
      });
    }
    return next(err);
  }
}
