import Template, { defaultTemplateZones, getDefaultTemplateData } from '../models/Template.model.js';
import { createStandardTemplates } from '../../shared/defaultTemplates.js';
import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import { scopedFilter } from '../middleware/auth.middleware.js';
import { sanitizeString } from '../services/ai/schema.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import { audit } from '../services/audit.service.js';
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
  cleanSections,
  editorVersionFor,
  elementContext,
  elementsForRead,
  storedEditorVersion,
  versionsThatFit,
} from '../services/template/elements.js';
import {
  EDITOR_VERSION,
  defaultPage,
  legacyToSections,
  normalizePage,
  normalizeSections,
} from '../../shared/templateElements.js';

/* The list also carries the placed items: every miniature a template is shown in draws the
   items it really stores, so a list can never disagree with the poster the editor saved. */
const LIST_FIELDS =
  'clientId name category eventTypes isActive isDefault version editorVersion updatedAt size layout zones page elements sections header content footer brandKit';
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

/* The name the Templates page gives an empty layout. The app chooses it, nobody types it, so a
   clash there means the browser is a click ahead of its own list rather than a real mistake. */
const AUTO_BLANK_NAME = /^untitled template( \d+)?$/i;

/** "Untitled template 1", then 2, 3… the first number this tenant does not already have. */
async function nextBlankName(clientId, name) {
  const base = name.replace(/\s+\d+$/, '').trim() || 'Untitled template';
  for (let index = 1; index <= 50; index += 1) {
    const candidate = `${base} ${index}`;
    if (!(await nameTaken(clientId, candidate))) return candidate;
  }
  return null;
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
    page: plain(template.page),
    elements: plain(template.elements || []),
    /* header, content and footer are the very same objects as the three under sections, so
       keeping both would store every item of this snapshot a third time. Ten snapshots of
       that filled a document that only ever holds one design. */
    sections: plain(template.sections),
    brandKit: plain(template.brandKit),
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

function cleanSectionsFor(req, sections, { brandKit, size }) {
  return cleanSections(sections, elementContext({ brandKit, clientId: req.clientId, size }));
}

/**
 * A layout that a team builds from scratch: the brand header and footer draw themselves and the
 * middle is a plain page with nothing placed on it. The editor opens on empty space instead of
 * rebuilding a starter design from the areas.
 */
function blankSectionsFor(brandKit) {
  return normalizeSections(
    {
      header: { elements: [] },
      content: { page: defaultPage(), elements: [] },
      footer: { elements: [] },
    },
    brandKit
  );
}

export async function getTemplates(req, res, next) {
  try {
    const filter = readScope(req);
    let templates = await Template.find(filter).select(LIST_FIELDS).sort(LIST_SORT).lean();

    if (templates.length === 0 && canSeeInactive(req)) {
      try {
        const standards = createStandardTemplates(req.clientId);
        await Template.insertMany(standards, { ordered: false });
      } catch (err) {
        if (!isDuplicateKey(err)) {
          const client = await Client.findById(req.clientId);
          try {
            await Template.create(getDefaultTemplateData(req.clientId, client?.name || 'Standard'));
          } catch (inner) {
            if (!isDuplicateKey(inner)) throw inner;
          }
        }
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
    const sections = template.sections
      ? normalizeSections(template.sections, brandKit, template)
      : legacyToSections(template, brandKit);

    let userDraft = undefined;
    if (template.draft && canSeeInactive(req) && String(template.draft.userId) === String(req.user._id)) {
      userDraft = {
        data: template.draft.data,
        savedAt: template.draft.savedAt,
        basedOnVersion: template.draft.basedOnVersion,
      };
    }
    const templateData = { ...template };
    if (userDraft) {
      templateData.draft = userDraft;
    } else {
      delete templateData.draft;
    }

    return res.status(200).set('Cache-Control', NO_STORE).json({
      success: true,
      data: {
        template: {
          ...templateData,
          editorVersion: storedEditorVersion(template),
          brandKit: template.brandKit || null,
          elements: elementsForRead(template, brandKit),
          sections,
          header: sections.header,
          content: sections.content,
          footer: sections.footer,
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

    /* A new layout from the Templates page asks for nothing but a name. It gets the standard
       areas at the standard poster size, which is what those areas are drawn for. */
    const startsBlank = req.body.zones === undefined;
    const size = normalizeTemplateSize(req.body.size);
    const zones = normalizeZones(req.body.zones ?? defaultTemplateZones());
    const layout = normalizeLayout(req.body.layout, zones);
    assertZoneLayout({ size, zones });

    const brandKit = await brandKitFor(req);
    const elements = req.body.elements
      ? cleanItemsFor(req, req.body.elements, { brandKit, size })
      : [];

    let sections;
    if (req.body.sections || req.body.header || req.body.footer || req.body.content) {
      const rawSections = req.body.sections || {
        header: req.body.header,
        content: req.body.content,
        footer: req.body.footer,
      };
      sections = cleanSectionsFor(req, rawSections, { brandKit, size });
    } else if (startsBlank) {
      sections = blankSectionsFor(brandKit);
    }

    /* Clicking New template again asks for one more empty layout, not for a complaint: when the
       number the app chose is already used it takes the next free one. A name somebody typed
       still clashes loudly, because only that person can choose another. */
    let finalName = name;
    if (startsBlank && AUTO_BLANK_NAME.test(name) && (await nameTaken(req.clientId, name))) {
      finalName = (await nextBlankName(req.clientId, name)) || name;
    }
    if (await nameTaken(req.clientId, finalName)) return duplicateName(res);

    const doc = {
      clientId: req.clientId,
      name: finalName,
      category: req.body.category || 'Event',
      size,
      zones,
      layout,
      page: req.body.page !== undefined ? normalizePage(req.body.page) : defaultPage(),
      elements,
      editorVersion: editorVersionFor(elements),
      version: 1,
      versions: [],
      /* An unfinished blank layout is not something the team should be offered yet. */
      isActive: !startsBlank,
      isDefault: false,
      brandKit: req.body.brandKit !== undefined ? (req.body.brandKit ? plain(req.body.brandKit) : null) : undefined,
      createdBy: req.user._id,
      /** Event types this template is designed for (empty = all types). */
      eventTypes: Array.isArray(req.body.eventTypes)
        ? req.body.eventTypes.filter((id) => typeof id === 'string')
        : [],
    };
    if (sections) {
      doc.sections = sections;
      doc.header = sections.header;
      doc.content = sections.content;
      doc.footer = sections.footer;
      doc.elements = sections.content.elements;
      doc.page = sections.content.page;
      /* An empty layout is still a layout of placed items: without this its areas would be read
         back as a design of their own the moment it opens. */
      doc.editorVersion = startsBlank ? EDITOR_VERSION : editorVersionFor(doc.elements);
    }
    assertTemplateDocSize(doc);

    const template = await Template.create(doc);

    await audit(req, 'template.create', {
      targetType: 'template',
      targetId: template._id,
      meta: { name: template.name },
    });

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
    const baseBrandKit = await brandKitFor(req);
    const brandKit = req.body.brandKit !== undefined
      ? (req.body.brandKit ? { ...baseBrandKit, ...plain(req.body.brandKit) } : baseBrandKit)
      : (template.brandKit ? { ...baseBrandKit, ...plain(template.brandKit) } : baseBrandKit);
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
    if (req.body.page !== undefined) changes.page = normalizePage(req.body.page);
    if (
      req.body.sections !== undefined ||
      req.body.header !== undefined ||
      req.body.footer !== undefined ||
      req.body.content !== undefined
    ) {
      const existingSections = template.sections ? plain(template.sections) : legacyToSections(template, brandKit);
      const rawSections = req.body.sections || {
        header: req.body.header ?? existingSections.header,
        content: req.body.content ?? existingSections.content,
        footer: req.body.footer ?? existingSections.footer,
      };
      const updatedSections = cleanSectionsFor(req, rawSections, { brandKit, size });
      changes.sections = updatedSections;
      changes.header = updatedSections.header;
      changes.content = updatedSections.content;
      changes.footer = updatedSections.footer;
      changes.elements = updatedSections.content.elements;
      changes.page = updatedSections.content.page;
      changes.editorVersion = editorVersionFor(changes.elements, storedEditorVersion(template));
    }
    if (req.body.name !== undefined) {
      const name = cleanName(req.body.name);
      if (!name) return sendBadRequest('Give the template a name.', res);
      if (await nameTaken(req.clientId, name, template._id)) return duplicateName(res);
      changes.name = name;
    }
    if (req.body.brandKit !== undefined) {
      changes.brandKit = req.body.brandKit ? plain(req.body.brandKit) : null;
    }
    if (req.body.eventTypes !== undefined) {
      changes.eventTypes = Array.isArray(req.body.eventTypes)
        ? req.body.eventTypes.filter((id) => typeof id === 'string')
        : [];
    }

    const archived = snapshotOf(template, req.body.note, req.user._id);
    const versions = versionsThatFit(
      { ...plain(template), ...changes },
      [...plain(template.versions || []), archived].slice(-TEMPLATE_MAX_VERSIONS)
    );

    const updated = await Template.findOneAndUpdate(
      scopedFilter(req, { _id: template._id, version: template.version }),
      {
        $set: { ...changes, versions, version: template.version + 1 },
        $unset: { draft: 1 },
      },
      { new: true, runValidators: true }
    );

    if (!updated) return conflict(res);

    await audit(req, 'template.update', {
      targetType: 'template',
      targetId: updated._id,
      meta: { name: updated.name },
    });

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
    const brandKit = await brandKitFor(req);
    /* The three bands live in sections; the top level items mirror only the middle one. A copy
       that carries just that mirror opens with an empty header, an empty footer and nothing in
       between, so the whole design travels across. */
    const storedSections = template.sections
      ? plain(template.sections)
      : legacyToSections(template, brandKit);
    const sections = cleanSectionsFor(req, storedSections, { brandKit, size });
    const elements = sections.content.elements;

    const copy = await Template.create({
      clientId: req.clientId,
      name,
      category: template.category,
      size,
      zones,
      layout: normalizeLayout(plain(template.layout), zones),
      sections,
      header: sections.header,
      content: sections.content,
      footer: sections.footer,
      page: sections.content.page,
      elements,
      editorVersion: editorVersionFor(elements, storedEditorVersion(template)),
      eventTypes: plain(template.eventTypes || []),
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

    await audit(req, 'template.delete', {
      targetType: 'template',
      targetId: template._id,
      meta: { name: template.name },
    });

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
      ...(source.page !== undefined ? { page: plain(source.page) } : {}),
      elements,
      editorVersion: editorVersionFor(elements),
    };
    const versions = versionsThatFit(
      { ...plain(template), ...changes },
      [...plain(template.versions || []), archived].slice(-TEMPLATE_MAX_VERSIONS)
    );

    const updated = await Template.findOneAndUpdate(
      scopedFilter(req, { _id: template._id, version: template.version }),
      {
        $set: {
          ...changes,
          versions,
          version: template.version + 1,
        },
        $unset: { draft: 1 },
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

export async function autosaveTemplateDraft(req, res, next) {
  try {
    const rate = await consumeRateLimit({
      key: `autosave:user:${req.user._id}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!rate.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many autosaves. Please wait a moment before saving again.',
          status: 429,
        },
      });
    }

    const template = await Template.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!template) return notFound(res);

    const basedOnVersion = Number(req.body.basedOnVersion);
    if (basedOnVersion !== template.version) {
      return conflict(res);
    }

    const brandKit = await brandKitFor(req);
    const draftPayload = req.body.data !== undefined ? req.body.data : { ...req.body };
    delete draftPayload.basedOnVersion;

    const size = normalizeTemplateSize(draftPayload.size ?? template.size);
    const zones = normalizeZones(draftPayload.zones ?? template.zones);
    const layout = normalizeLayout({ ...plain(template.layout), ...plain(draftPayload.layout) }, zones);
    assertZoneLayout({ size, zones });

    let sections;
    if (
      draftPayload.sections !== undefined ||
      draftPayload.header !== undefined ||
      draftPayload.footer !== undefined ||
      draftPayload.content !== undefined
    ) {
      const existingSections = template.sections ? plain(template.sections) : legacyToSections(template, brandKit);
      const rawSections = draftPayload.sections || {
        header: draftPayload.header ?? existingSections.header,
        content: draftPayload.content ?? existingSections.content,
        footer: draftPayload.footer ?? existingSections.footer,
      };
      sections = cleanSectionsFor(req, rawSections, { brandKit, size });
    }

    const elements =
      draftPayload.elements !== undefined
        ? cleanItemsFor(req, draftPayload.elements, { brandKit, size })
        : sections?.content?.elements ?? plain(template.elements || []);

    const cleanData = {
      ...draftPayload,
      size,
      zones,
      layout,
      elements,
      ...(sections
        ? {
            sections,
            header: sections.header,
            content: sections.content,
            footer: sections.footer,
          }
        : {}),
    };
    if (draftPayload.page !== undefined) cleanData.page = normalizePage(draftPayload.page);
    if (draftPayload.name !== undefined) cleanData.name = cleanName(draftPayload.name);

    assertTemplateDocSize({ ...plain(template), ...cleanData });

    const savedAt = new Date();
    const draftObj = {
      data: cleanData,
      savedAt,
      basedOnVersion,
      userId: req.user._id,
    };

    await Template.updateOne(
      scopedFilter(req, { _id: template._id }),
      { $set: { draft: draftObj } }
    );

    return res.status(200).json({
      success: true,
      data: {
        draft: {
          data: cleanData,
          savedAt,
          basedOnVersion,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getTemplateDraft(req, res, next) {
  try {
    const template = await Template.findOne(scopedFilter(req, { _id: req.params.id })).select('draft clientId');
    if (!template) return notFound(res);
    if (!template.draft) {
      return res.status(404).json({
        success: false,
        error: { message: 'No draft found for this template', status: 404 },
      });
    }
    if (String(template.draft.userId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { message: "You cannot view another user's draft.", status: 403 },
      });
    }
    return res.status(200).set('Cache-Control', NO_STORE).json({
      success: true,
      data: {
        draft: {
          data: template.draft.data,
          savedAt: template.draft.savedAt,
          basedOnVersion: template.draft.basedOnVersion,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function discardTemplateDraft(req, res, next) {
  try {
    const template = await Template.findOne(scopedFilter(req, { _id: req.params.id })).select('draft clientId');
    if (!template) return notFound(res);
    if (template.draft && String(template.draft.userId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { message: "You cannot discard another user's draft.", status: 403 },
      });
    }
    await Template.updateOne(scopedFilter(req, { _id: template._id }), { $unset: { draft: 1 } });
    return res.status(200).json({ success: true, data: { discarded: true } });
  } catch (err) {
    return next(err);
  }
}

