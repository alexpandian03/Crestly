import BrandKit from '../models/BrandKit.model.js';
import { scopedFilter } from '../middleware/auth.middleware.js';
import {
  brandBandIssues,
  mergeBrandKitUpdate,
  withBrandKitDefaults,
  withEditableBands,
} from '../services/brand/style.js';
import { audit } from '../services/audit.service.js';

function kitForEditor(kit) {
  return withEditableBands(withBrandKitDefaults(kit));
}

/* The kit as the brand-layer editor shows it: its own settings, plus the header and footer
   bands it draws with - the items stored on the kit, or the ones its settings convert into
   when the band has never been laid out. Nothing here writes: a kit saved before bands
   existed stays exactly as it is until an admin saves the band. */
function renderKit(doc) {
  return kitForEditor(doc ? doc.toObject() : null);
}

function bandContext(kit) {
  return {
    clientId: String(kit.clientId || ''),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    size: kit.defaultPosterSize,
  };
}

/**
 * Get BrandKit for the current tenant (req.clientId)
 */
export async function getBrandKit(req, res, next) {
  try {
    const clientId = req.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'No client context resolved for BrandKit retrieval', status: 400 },
      });
    }

    const brandKit = await BrandKit.findOne(scopedFilter(req)).lean();
    if (!brandKit) {
      return res.status(404).json({
        success: false,
        error: { message: 'Brand kit not found for this organization', status: 404 },
      });
    }

    return res.status(200).json({
      success: true,
      data: { brandKit: kitForEditor(brandKit) },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update or upsert BrandKit for the current tenant (req.clientId).
 * The body may carry one section or the whole kit; anything missing keeps its
 * stored value, and unknown keys were already dropped by validation.
 */
export async function updateBrandKit(req, res, next) {
  try {
    const clientId = req.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'No client context resolved for BrandKit update', status: 400 },
      });
    }

    const stored = await BrandKit.findOne(scopedFilter(req)).lean();
    const merged = mergeBrandKitUpdate(stored, req.body);

    /* The band rules the editor cannot check on its own: where an item may sit depends on the
       size this organization's posters are made at, which only the merged kit knows. Items the
       kit itself converts its settings into are laid out for the band, so only asked-for
       items are checked. */
    const problems = brandBandIssues(merged, bandContext(merged));
    if (problems.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: problems[0], status: 400 },
      });
    }

    /* A kit whose bands carry no items yet is stored with the ones its own settings convert
       into, so the brand-layer editor always opens on something to move. The band stays in
       mode "legacy", which means it keeps drawing the settings until an admin says otherwise. */
    const seeded = withEditableBands(merged);

    const updated = await BrandKit.findOneAndUpdate(
      scopedFilter(req),
      { $set: { ...seeded, clientId, orgName: seeded.orgName || 'Organization' } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await audit(req, 'brandkit.update', {
      targetType: 'brandkit',
      targetId: updated._id,
      meta: { orgName: updated.orgName },
    });

    return res.status(200).json({
      success: true,
      data: { brandKit: renderKit(updated) },
    });
  } catch (err) {
    return next(err);
  }
}
