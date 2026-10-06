import BrandKit from '../models/BrandKit.model.js';
import { scopedFilter } from '../middleware/auth.middleware.js';
import { mergeBrandKitUpdate, withBrandKitDefaults } from '../services/brand/style.js';

function renderKit(doc) {
  return withBrandKitDefaults(doc ? doc.toObject() : null);
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
      data: { brandKit: withBrandKitDefaults(brandKit) },
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

    const updated = await BrandKit.findOneAndUpdate(
      scopedFilter(req),
      { $set: { ...merged, clientId, orgName: merged.orgName || 'Organization' } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      data: { brandKit: renderKit(updated) },
    });
  } catch (err) {
    return next(err);
  }
}
