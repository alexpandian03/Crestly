import BrandKit from '../models/BrandKit.model.js';
import { scopedFilter } from '../middleware/auth.middleware.js';

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

    const brandKit = await BrandKit.findOne(scopedFilter(req));
    if (!brandKit) {
      return res.status(404).json({
        success: false,
        error: { message: 'Brand kit not found for this organization', status: 404 },
      });
    }

    res.status(200).json({
      success: true,
      data: { brandKit },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update or upsert BrandKit for the current tenant (req.clientId)
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

    const {
      orgName,
      logos,
      colors,
      fonts,
      header,
      footer,
      defaultPosterSize,
    } = req.body;

    const updated = await BrandKit.findOneAndUpdate(
      scopedFilter(req),
      {
        clientId,
        ...(orgName && { orgName: orgName.trim() }),
        ...(logos && { logos }),
        ...(colors && { colors }),
        ...(fonts && { fonts }),
        ...(header && { header }),
        ...(footer && { footer }),
        ...(defaultPosterSize && { defaultPosterSize }),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      data: { brandKit: updated },
    });
  } catch (err) {
    next(err);
  }
}
