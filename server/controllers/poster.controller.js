import Template from '../models/Template.model.js';
import BrandKit from '../models/BrandKit.model.js';
import Client from '../models/Client.model.js';
import Poster, { POSTER_MAX_VERSIONS, normalizePosterRecord } from '../models/Poster.model.js';
import { TEMPLATE_SIZE_DEFAULT } from '../services/template/zones.js';
import { scopedFilter } from '../middleware/auth.middleware.js';
import {
  sanitizeString,
  normalizePosterContent,
  normalizeImageUrl,
  contentValuesContext,
  remapContentToDesign,
} from '../services/poster/content.js';
import { captureDesign } from '../services/poster/design.js';
import storageService from '../services/storage.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import { isValidEventType } from '../../shared/eventTypes.js';
import { audit } from '../services/audit.service.js';

const DEFAULT_CANVAS_TEMPLATE = {
  name: 'Standard poster',
  size: TEMPLATE_SIZE_DEFAULT,
  zones: [
    { id: 'zone-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
    { id: 'zone-content', type: 'content', x: 0, y: 140, w: 1080, h: 1080, locked: false },
    { id: 'zone-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
  ],
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function posterScope(req, extra = {}) {
  const filter = scopedFilter(req, { ...extra, isDeleted: false });
  if (req.user.role === 'user') filter.userId = req.user._id;
  return filter;
}

function plainDesign(design) {
  if (!design) return undefined;
  return typeof design.toObject === 'function' ? design.toObject() : design;
}

async function startingDesign(req, template) {
  const brandKit = await BrandKit.findOne(scopedFilter(req)).lean();
  return captureDesign({ brandKit, template: template || DEFAULT_CANVAS_TEMPLATE });
}

async function designForPoster(req, poster, template) {
  const brandKit = await BrandKit.findOne(scopedFilter(req)).lean();
  const stored = plainDesign(poster.design)?.template;
  return captureDesign({ brandKit, template: template || stored || DEFAULT_CANVAS_TEMPLATE });
}

export async function createPosterController(req, res, next) {
  try {
    const client = await Client.findById(req.clientId).select('requireEmailVerification').lean();
    if (client?.requireEmailVerification && !req.user?.isEmailVerified) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Please verify your email address before creating posters.',
          status: 403,
        },
      });
    }

    const template = req.body.templateId
      ? await Template.findOne(scopedFilter(req, { _id: req.body.templateId, isActive: true }))
      : await Template.findOne(scopedFilter(req, { isActive: true })).sort({ isDefault: -1, createdAt: -1 });

    const templateVersion = template?.version || 1;
    const design = await startingDesign(req, template);
    const content = normalizePosterContent(req.body.content, contentValuesContext(design, req.clientId));
    const prompt = sanitizeString(req.body.prompt).slice(0, 1000);

    const poster = await Poster.create({
      clientId: req.clientId,
      userId: req.user._id,
      ...(template?._id ? { templateId: template._id } : {}),
      templateVersion,
      design,
      title: content.title,
      prompt,
      content,
      eventType: isValidEventType(req.body.eventType) ? req.body.eventType : 'general',
      versions: [
        {
          content,
          note: 'Created',
          versionNumber: 1,
          templateVersion,
          design,
          createdBy: req.user._id,
          createdAt: new Date(),
        },
      ],
      currentVersion: 1,
      status: 'draft',
    });

    return res.status(201).json({ success: true, data: { poster: normalizePosterRecord(poster) } });
  } catch (err) {
    next(err);
  }
}

export async function listPostersController(req, res, next) {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 12;
    const { q, category, status, from, to } = req.query;
    const filter = posterScope(req);

    if (status) filter.status = status;
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: pattern }, { prompt: pattern }];
    }
    if (category) {
      const templates = await Template.find(
        scopedFilter(req, { category: new RegExp(`^${escapeRegex(category)}$`, 'i') })
      ).select('_id');
      if (templates.length === 0) {
        return res.status(200).json({ success: true, data: { items: [], total: 0, page, pages: 1 } });
      }
      filter.templateId = { $in: templates.map((item) => item._id) };
    }
    if (from || to) {
      filter.updatedAt = {};
      if (from) filter.updatedAt.$gte = new Date(from);
      if (to) filter.updatedAt.$lte = new Date(to);
    }

    const [rawItems, total] = await Promise.all([
      Poster.find(filter)
        .select(
          '-versions -__v -design.brandKit -design.template.zones -design.template.layout -design.template.elements'
        )
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Poster.countDocuments(filter),
    ]);

    const items = rawItems.map((item) => normalizePosterRecord(item));

    return res.status(200).json({
      success: true,
      data: { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
}

async function templateForPoster(req, poster) {
  if (!poster.templateId) return null;
  const template = await Template.findOne(scopedFilter(req, { _id: poster.templateId })).lean();
  if (!template) return null;

  const pinned = poster.templateVersion;
  if (!pinned || pinned === template.version) return template;

  const snapshot = (template.versions || []).find((entry) => entry.version === pinned);
  if (!snapshot) return template;

  return {
    ...template,
    version: snapshot.version,
    name: snapshot.name,
    zones: snapshot.zones,
    layout: snapshot.layout,
    size: snapshot.size,
  };
}

export async function getPosterController(req, res, next) {
  try {
    const rawPoster = await Poster.findOne(posterScope(req, { _id: req.params.id })).select('-__v');
    if (!rawPoster) {
      return res.status(404).json({
        success: false,
        error: { message: 'Poster not found or inaccessible for your organization.', status: 404 },
      });
    }
    const poster = normalizePosterRecord(rawPoster);
    const stored = plainDesign(poster.design)?.template;
    const template = stored
      ? { ...stored, _id: stored.templateId }
      : await templateForPoster(req, poster);

    if (rawPoster.draft && String(rawPoster.draft.userId) === String(req.user._id)) {
      poster.draft = {
        data: rawPoster.draft.data,
        savedAt: rawPoster.draft.savedAt,
        basedOnVersion: rawPoster.draft.basedOnVersion,
      };
    } else {
      delete poster.draft;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, data: { poster, template } });
  } catch (err) {
    next(err);
  }
}

function conflictResponse(res) {
  return res.status(409).json({
    success: false,
    error: {
      message: 'This poster was changed somewhere else. Reload to continue.',
      status: 409,
    },
  });
}

function posterNotFound(res) {
  return res.status(404).json({
    success: false,
    error: { message: 'Poster not found or inaccessible for your organization.', status: 404 },
  });
}

async function loadPoster(req) {
  return Poster.findOne(posterScope(req, { _id: req.params.id })).select('-__v');
}

async function appendVersion(req, poster, content, note, options = {}) {
  const versionNumber = poster.currentVersion + 1;
  const pinned = options.templateVersion ?? poster.templateVersion;
  const versionDesign = options.design ?? plainDesign(poster.design);

  const versionDoc = { content, note, versionNumber, createdBy: req.user._id, createdAt: new Date() };
  if (pinned) versionDoc.templateVersion = pinned;
  if (versionDesign) versionDoc.design = versionDesign;

  const setFields = { content, title: content.title, currentVersion: versionNumber };
  if (pinned) setFields.templateVersion = pinned;
  if (options.design) setFields.design = options.design;

  return Poster.findOneAndUpdate(
    posterScope(req, { _id: poster._id, currentVersion: poster.currentVersion }),
    {
      $push: {
        versions: { $each: [versionDoc], $slice: -POSTER_MAX_VERSIONS },
      },
      $set: setFields,
      $unset: { draft: 1 },
    },
    { new: true }
  ).select('-__v');
}

export async function updatePosterController(req, res, next) {
  try {
    const poster = await loadPoster(req);
    if (!poster) return posterNotFound(res);
    if (req.body.expectedVersion !== poster.currentVersion) return conflictResponse(res);

    const content = normalizePosterContent(req.body.content, contentValuesContext(poster.design, req.clientId));
    const note = sanitizeString(req.body.note || 'Edited').slice(0, 120);
    const updated = await appendVersion(req, poster, content, note);
    if (!updated) return conflictResponse(res);

    return res.status(200).json({ success: true, data: { poster: updated } });
  } catch (err) {
    next(err);
  }
}

export async function addPosterVersionController(req, res, next) {
  try {
    const poster = await loadPoster(req);
    if (!poster) return posterNotFound(res);

    const expected = req.body.expectedVersion ?? poster.currentVersion;
    if (expected !== poster.currentVersion) return conflictResponse(res);

    const template = poster.templateId
      ? await Template.findOne(scopedFilter(req, { _id: poster.templateId })).lean()
      : null;
    const design = await designForPoster(req, poster, template);
    const content = normalizePosterContent(req.body.content, contentValuesContext(design, req.clientId));
    const updated = await appendVersion(req, poster, content, 'Regenerated', {
      templateVersion: template?.version || poster.templateVersion,
      design,
    });
    if (!updated) return conflictResponse(res);

    return res.status(200).json({ success: true, data: { poster: updated } });
  } catch (err) {
    next(err);
  }
}

export async function restorePosterVersionController(req, res, next) {
  try {
    const poster = await loadPoster(req);
    if (!poster) return posterNotFound(res);

    const expected = req.body.expectedVersion ?? poster.currentVersion;
    if (expected !== poster.currentVersion) return conflictResponse(res);

    const wanted = req.body.versionNumber;
    const source = poster.versions.find(
      (version, index) => (version.versionNumber ?? index + 1) === wanted
    );
    if (!source) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Version ${wanted} is no longer available for this poster.`,
          status: 400,
        },
      });
    }

    const targetDesign = plainDesign(source.design) ?? plainDesign(poster.design);
    const { content: remapped } = remapContentToDesign(
      source.content,
      plainDesign(source.design) ?? plainDesign(poster.design),
      targetDesign
    );
    const content = normalizePosterContent(
      remapped,
      contentValuesContext(targetDesign, req.clientId)
    );
    const note = `Restored version ${wanted}`;
    const updated = await appendVersion(req, poster, content, note, {
      templateVersion: source.templateVersion ?? poster.templateVersion,
      design: targetDesign,
    });
    if (!updated) return conflictResponse(res);

    return res.status(200).json({ success: true, data: { poster: updated } });
  } catch (err) {
    next(err);
  }
}

export async function duplicatePosterController(req, res, next) {
  try {
    const poster = await loadPoster(req);
    if (!poster) return posterNotFound(res);

    const content = normalizePosterContent(poster.content, contentValuesContext(poster.design, req.clientId));
    const template = poster.templateId
      ? await Template.findOne(scopedFilter(req, { _id: poster.templateId })).lean()
      : null;
    const design = plainDesign(poster.design) || (await designForPoster(req, poster, template));
    const versionDoc = { content, note: 'Created', versionNumber: 1, createdBy: req.user._id, createdAt: new Date() };
    if (poster.templateVersion) versionDoc.templateVersion = poster.templateVersion;
    versionDoc.design = design;

    const copy = await Poster.create({
      clientId: req.clientId,
      userId: req.user._id,
      ...(poster.templateId ? { templateId: poster.templateId } : {}),
      ...(poster.templateVersion ? { templateVersion: poster.templateVersion } : {}),
      design,
      title: content.title,
      prompt: poster.prompt,
      content,
      versions: [versionDoc],
      currentVersion: 1,
      status: 'draft',
      thumbnailUrl: poster.thumbnailUrl,
    });

    return res.status(201).json({ success: true, data: { poster: normalizePosterRecord(copy) } });
  } catch (err) {
    next(err);
  }
}

export async function applyLatestDesignController(req, res, next) {
  try {
    const poster = await loadPoster(req);
    if (!poster) return posterNotFound(res);

    const expected = req.body.expectedVersion ?? poster.currentVersion;
    if (expected !== poster.currentVersion) return conflictResponse(res);

    const template = poster.templateId
      ? await Template.findOne(scopedFilter(req, { _id: poster.templateId })).lean()
      : null;
    const design = await designForPoster(req, poster, template);
    const { content: remapped } = remapContentToDesign(
      poster.content,
      poster.design,
      design
    );
    const content = normalizePosterContent(remapped, contentValuesContext(design, req.clientId));
    const updated = await appendVersion(req, poster, content, 'Updated to the latest brand design', {
      templateVersion: template?.version || poster.templateVersion,
      design,
    });
    if (!updated) return conflictResponse(res);

    return res.status(200).json({ success: true, data: { poster: updated } });
  } catch (err) {
    next(err);
  }
}

export async function deletePosterController(req, res, next) {
  try {
    const poster = await Poster.findOneAndUpdate(
      posterScope(req, { _id: req.params.id }),
      { $set: { isDeleted: true } },
      { new: true }
    ).select('_id');
    if (!poster) return posterNotFound(res);

    return res.status(200).json({ success: true, data: { id: poster._id.toString() } });
  } catch (err) {
    next(err);
  }
}

function sniffImageFormat(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isWebp ? 'webp' : null;
}

export async function uploadPosterThumbnailController(req, res, next) {
  try {
    const poster = await Poster.findOne(posterScope(req, { _id: req.params.id })).select('_id');
    if (!poster) return posterNotFound(res);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No image uploaded. Provide a JPEG or WebP under 300 KB.', status: 400 },
      });
    }
    if (!sniffImageFormat(req.file.buffer)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Thumbnail must be a JPEG or WebP image.', status: 400 },
      });
    }

    const upload = await storageService.uploadBuffer(req.file.buffer, {
      folder: `thumbnails/${req.clientId}`,
      publicId: poster._id.toString(),
      mimetype: req.file.mimetype,
    });

    const thumbnailUrl = normalizeImageUrl(upload.secure_url || upload.url, 'thumbnailUrl');
    poster.thumbnailUrl = thumbnailUrl;
    await poster.save();

    await audit(req, 'poster.export', {
      targetType: 'poster',
      targetId: poster._id,
      meta: { format: 'thumbnail' },
    });

    return res.status(200).json({ success: true, data: { thumbnailUrl } });
  } catch (err) {
    next(err);
  }
}

export async function autosavePosterDraftController(req, res, next) {
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

    const poster = await loadPoster(req);
    if (!poster) return posterNotFound(res);

    const basedOnVersion = Number(req.body.basedOnVersion);
    if (basedOnVersion !== poster.currentVersion) {
      return conflictResponse(res);
    }

    const rawContent = req.body.data?.content || req.body.content || req.body.data;
    const content = normalizePosterContent(
      rawContent,
      contentValuesContext(poster.design, req.clientId)
    );

    const draftData = {
      ...(req.body.data || {}),
      content,
      title: content.title,
    };
    const savedAt = new Date();
    const draftObj = {
      data: draftData,
      savedAt,
      basedOnVersion,
      userId: req.user._id,
    };

    await Poster.updateOne(
      posterScope(req, { _id: poster._id }),
      { $set: { draft: draftObj } }
    );

    return res.status(200).json({
      success: true,
      data: {
        draft: {
          data: draftData,
          savedAt,
          basedOnVersion,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getPosterDraftController(req, res, next) {
  try {
    const poster = await Poster.findOne(posterScope(req, { _id: req.params.id })).select('draft userId clientId');
    if (!poster) return posterNotFound(res);
    if (!poster.draft) {
      return res.status(404).json({
        success: false,
        error: { message: 'No draft found for this poster', status: 404 },
      });
    }
    if (String(poster.draft.userId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { message: "You cannot view another user's draft.", status: 403 },
      });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      data: {
        draft: {
          data: poster.draft.data,
          savedAt: poster.draft.savedAt,
          basedOnVersion: poster.draft.basedOnVersion,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function discardPosterDraftController(req, res, next) {
  try {
    const poster = await Poster.findOne(posterScope(req, { _id: req.params.id })).select('draft userId clientId');
    if (!poster) return posterNotFound(res);
    if (poster.draft && String(poster.draft.userId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { message: "You cannot discard another user's draft.", status: 403 },
      });
    }
    await Poster.updateOne(posterScope(req, { _id: poster._id }), { $unset: { draft: 1 } });
    return res.status(200).json({ success: true, data: { discarded: true } });
  } catch (err) {
    next(err);
  }
}
