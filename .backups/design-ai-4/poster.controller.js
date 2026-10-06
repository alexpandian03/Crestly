import Template from '../models/Template.model.js';
import BrandKit from '../models/BrandKit.model.js';
import Client from '../models/Client.model.js';
import Poster, { POSTER_MAX_VERSIONS } from '../models/Poster.model.js';
import { variableSlotsOf } from '../../shared/templateElements.js';
import { TEMPLATE_SIZE_DEFAULT } from '../services/template/zones.js';
import { scopedFilter } from '../middleware/auth.middleware.js';
import { generateContent, generateDesign } from '../services/ai/index.js';
import { resolveImage } from '../services/images.js';
import { sanitizeString, designToContent } from '../services/ai/schema.js';
import { normalizePosterContent, normalizeImageUrl, contentValuesContext } from '../services/poster/content.js';
import { captureDesign } from '../services/poster/design.js';
import {
  buildRecipeDesign,
  readRecipe,
  recipeNeedsPhoto,
  recipePayload,
} from '../services/poster/recipe.js';
import storageService from '../services/storage.js';

/**
 * POST /api/posters/generate with mode "ai": one whole design taken from a recipe, plus the
 * words that go on it. Whether this mode is open is the organization's setting, not the user's.
 */
async function generateFromRecipe(req, res, { templateId, prompt, instruction, avoidRecipeIds, variant }) {
  const client = await Client.findById(req.clientId).select('designModes').lean();
  if (!(client?.designModes?.ai ?? true)) {
    return res.status(403).json({
      success: false,
      error: {
        message:
          'Designs written by the assistant are switched off for your organization. An administrator can turn them on in organization settings.',
        status: 403,
      },
    });
  }

  let brandKit = await BrandKit.findOne(scopedFilter(req)).lean();
  if (!brandKit) {
    brandKit = { orgName: 'Our Organization', colors: {}, fonts: {}, header: {}, footer: {} };
  }

  /* The size comes from the layout asked for, else the tenant's first active template,
     else the brand kit's own poster size. No template at all is not an error here. */
  const template = templateId
    ? await Template.findOne(scopedFilter(req, { _id: templateId, isActive: true })).lean()
    : await Template.findOne(scopedFilter(req, { isActive: true })).sort({ createdAt: 1 }).lean();
  const size = template?.size || brandKit.defaultPosterSize || TEMPLATE_SIZE_DEFAULT;

  // Generate the design (timeout, retry, sanitization handled internally)
  // STAGE-10-COUNT: one AI generation. Count it here against the client's plan limit.
  const answer = await generateDesign({ prompt, brandKit, instruction, avoidRecipeIds, variant });
  const content = designToContent(answer);
  const built = buildRecipeDesign({
    recipe: { recipeId: answer.recipeId, variant: answer.variant, icon: answer.icon },
    content,
    brandKit,
    size,
  });

  /* Only a design that shows a picture looks one up, and a photo that cannot be found
     never fails the request. */
  content.imageUrl = recipeNeedsPhoto(built.recipeId) ? await resolveImage(content.imageQuery) : '';

  return res.status(200).json({ success: true, data: { design: recipePayload(built), content } });
}

/**
 * POST /api/posters/generate
 * Generates structured poster content using the configured AI provider.
 * Does NOT log prompt text or API keys.
 */
export async function generatePosterContentController(req, res, next) {
  try {
    const clientId = req.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Tenant context could not be resolved', status: 400 },
      });
    }

    const { templateId, prompt, instruction, mode = 'template', avoidRecipeIds, variant } = req.body;

    if (mode === 'ai') {
      return generateFromRecipe(req, res, { templateId, prompt, instruction, avoidRecipeIds, variant });
    }

    // Load template scoped strictly to the authenticated tenant.
    // If templateId is omitted, fall back to the first active template.
    let template;
    if (templateId) {
      template = await Template.findOne(scopedFilter(req, { _id: templateId, isActive: true }));
    } else {
      template = await Template.findOne(scopedFilter(req, { isActive: true })).sort({ createdAt: 1 });
    }

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          message: templateId
            ? 'Template not found or inaccessible for your organization.'
            : 'No active template found for your organization. Please contact your admin.',
          status: 404,
        },
      });
    }

    // Load tenant brand kit
    let brandKit = await BrandKit.findOne(scopedFilter(req));
    if (!brandKit) {
      brandKit = { orgName: 'Our Organization', colors: {}, fonts: {}, header: {}, footer: {} };
    }

    /* The blanks this template's own items leave: words the assistant may fill, photos a
       person replaces. A layout without items offers nothing, exactly as before. */
    const slots = variableSlotsOf(template.elements);
    const variables = slots.texts.map(({ key, label, hint, maxLength }) => ({ key, label, hint, maxLength }));
    const imageSlots = slots.images;

    // Generate content (timeout, retry, sanitization handled internally)
    // STAGE-10-COUNT: one AI generation. Count it here against the client's plan limit.
    const content = await generateContent({
      prompt,
      brandKit,
      template,
      instruction,
      variables,
    });

    // Resolve optional image via Pexels (returns empty string on failure/timeout)
    const imageUrl = await resolveImage(content.imageQuery);

    return res.status(200).json({
      success: true,
      data: {
        content: {
          ...content,
          imageUrl,
        },
        /* Photo blanks are never generated: the person making the poster replaces them. */
        imageSlots: imageSlots.map((slot) => ({ key: slot.key, label: slot.label })),
      },
    });
  } catch (err) {
    next(err);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function posterScope(req, extra = {}) {
  const filter = scopedFilter(req, { ...extra, isDeleted: false });
  if (req.user.role === 'user') filter.userId = req.user._id;
  return filter;
}

/**
 * Freezes the look a new poster starts with: this tenant's brand kit, and either its own
 * template or the design recipe this request asked for. Nothing about the look is taken
 * from the body except the recipe's name, arrangement and mark.
 */
async function startingDesign(req, template, recipe, content) {
  const brandKit = await BrandKit.findOne(scopedFilter(req)).lean();
  const built = recipe
    ? buildRecipeDesign({ recipe, content, brandKit, size: template.size })
    : template;
  return captureDesign({ brandKit, template: built });
}

function plainDesign(design) {
  if (!design) return undefined;
  return typeof design.toObject === 'function' ? design.toObject() : design;
}

/**
 * Re-captures the look for an existing poster; a deleted template keeps the stored layout.
 * A poster made from a design recipe keeps that recipe: it is re-built against today's brand
 * kit rather than falling back to the organization's template.
 */
async function designForPoster(req, poster, template) {
  const brandKit = await BrandKit.findOne(scopedFilter(req)).lean();
  const stored = plainDesign(poster.design)?.template;
  if (stored?.recipeId) {
    return captureDesign({
      brandKit,
      template: buildRecipeDesign({
        recipe: { recipeId: stored.recipeId, variant: stored.variant, icon: stored.icon },
        content: poster.content,
        brandKit,
        size: stored.size,
      }),
    });
  }
  return captureDesign({ brandKit, template: template || stored || null });
}

export async function createPosterController(req, res, next) {
  try {
    const template = await Template.findOne(
      scopedFilter(req, { _id: req.body.templateId, isActive: true })
    );
    if (!template) {
      return res.status(404).json({
        success: false,
        error: { message: 'Template not found or inaccessible for your organization.', status: 404 },
      });
    }

    const recipe = req.body.recipe ? readRecipe(req.body.recipe) : null;
    const templateVersion = template.version || 1;
    const design = await startingDesign(req, template, recipe, req.body.content);
    /* Filled-in words are checked against the blanks this poster's own design offers. */
    const content = normalizePosterContent(req.body.content, contentValuesContext(design, req.clientId));
    const prompt = sanitizeString(req.body.prompt).slice(0, 1000);

    const poster = await Poster.create({
      clientId: req.clientId,
      userId: req.user._id,
      templateId: template._id,
      templateVersion,
      design,
      title: content.title,
      prompt,
      content,
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

    return res.status(201).json({ success: true, data: { poster } });
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

    const [items, total] = await Promise.all([
      Poster.find(filter)
        /* Cards only need to know which look a poster wears, not the whole snapshot. */
        .select(
          '-versions -__v -design.brandKit -design.template.zones -design.template.layout -design.template.elements'
        )
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Poster.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * The template as this poster was made with: the live document when the pin matches (or the
 * poster predates pinning), otherwise the archived state the template still keeps. A template
 * keeps its last 10 states, so a pin older than that falls back to the current layout rather
 * than failing to render.
 */
async function templateForPoster(req, poster) {
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
    const poster = await Poster.findOne(posterScope(req, { _id: req.params.id })).select('-__v');
    if (!poster) {
      return res.status(404).json({
        success: false,
        error: { message: 'Poster not found or inaccessible for your organization.', status: 404 },
      });
    }
    const stored = plainDesign(poster.design)?.template;
    /* The frozen snapshot wins; posters saved before snapshots fall back to the pinned
       template state, and only then to the live document. `_id` is echoed so callers that
       key templates by id still recognise the snapshot as the poster's own template. */
    const template = stored
      ? { ...stored, _id: stored.templateId }
      : await templateForPoster(req, poster);
    /* One poster, one tenant, one response: never let a proxy or the browser replay it. */
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

/**
 * Appends a new version atomically: the update only applies while currentVersion still equals
 * the version we read, so two editors cannot silently overwrite each other.
 * Returns the updated poster, null on a version conflict, or undefined when the poster vanished.
 */
async function appendVersion(req, poster, content, note, options = {}) {
  // STAGE-10-COUNT: a regeneration writes a new version. Count AI-based versions here.
  const versionNumber = poster.currentVersion + 1;
  const pinned = options.templateVersion ?? poster.templateVersion;
  /* Every version keeps its own look; a plain text edit inherits the poster's current one. */
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
    },
    { new: true }
  ).select('-__v');
}

function versionNoteFor(instruction) {
  const labels = {
    shorter: 'Shorter',
    minimal: 'Minimal',
    'more professional': 'More professional',
    'emphasize date': 'Emphasized date',
    'change image': 'Changed image',
  };
  return labels[instruction] || 'Regenerated';
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

    const template = await Template.findOne(
      scopedFilter(req, { _id: poster.templateId })
    ).lean();
    const design = await designForPoster(req, poster, template);
    const content = normalizePosterContent(req.body.content, contentValuesContext(design, req.clientId));
    const updated = await appendVersion(
      req,
      poster,
      content,
      versionNoteFor(req.body.instruction),
      { templateVersion: template?.version || poster.templateVersion, design }
    );
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

    /* A stored version is validated against the design it was written for. */
    const content = normalizePosterContent(
      source.content,
      contentValuesContext(plainDesign(source.design) ?? plainDesign(poster.design), req.clientId)
    );
    const updated = await appendVersion(
      req,
      poster,
      content,
      `Restored version ${wanted}`,
      {
        templateVersion: source.templateVersion ?? poster.templateVersion,
        /* Restoring brings the old look back with the old words. */
        design: plainDesign(source.design) ?? plainDesign(poster.design),
      }
    );
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
    const template = await Template.findOne(
      scopedFilter(req, { _id: poster.templateId })
    ).lean();
    const design = await designForPoster(req, poster, template);
    const versionDoc = { content, note: 'Created', versionNumber: 1, createdBy: req.user._id, createdAt: new Date() };
    if (poster.templateVersion) versionDoc.templateVersion = poster.templateVersion;
    versionDoc.design = design;
    const copy = await Poster.create({
      clientId: req.clientId,
      userId: req.user._id,
      templateId: poster.templateId,
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

    return res.status(201).json({ success: true, data: { poster: copy } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/posters/:id/apply-latest-design
 * Re-captures the tenant's current brand kit and template as a NEW version, for people who
 * want an old poster to wear the new look. Text stays; the version check is the usual one.
 */
export async function applyLatestDesignController(req, res, next) {
  try {
    const poster = await loadPoster(req);
    if (!poster) return posterNotFound(res);

    const expected = req.body.expectedVersion ?? poster.currentVersion;
    if (expected !== poster.currentVersion) return conflictResponse(res);

    const template = await Template.findOne(
      scopedFilter(req, { _id: poster.templateId })
    ).lean();
    const design = await designForPoster(req, poster, template);
    const content = normalizePosterContent(poster.content, contentValuesContext(poster.design, req.clientId));
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

    return res.status(200).json({ success: true, data: { thumbnailUrl } });
  } catch (err) {
    next(err);
  }
}
