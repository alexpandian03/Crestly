import storageService from '../services/storage.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import { SIGNATURE_LIMIT_PER_HOUR, brandImageFolder } from '../services/brand/style.js';

const SIGN_WINDOW_MS = 60 * 60 * 1000;

/**
 * Handle logo upload via in-memory buffer to Cloudinary
 */
export async function uploadLogo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded. Please provide an image under the "logo" field.', status: 400 },
      });
    }

    const clientId = req.clientId || 'generic';
    const folder = `ai-posters/tenants/${clientId}/logos`;

    const uploadResult = await storageService.uploadBuffer(req.file.buffer, {
      folder,
      filename: `logo_${Date.now()}`,
      mimetype: req.file.mimetype,
    });

    res.status(200).json({
      success: true,
      data: {
        url: uploadResult.secure_url || uploadResult.url,
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle poster content image upload (any authenticated user)
 */
export async function uploadPosterImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file provided. Upload a JPG, PNG or WebP under 2 MB.', status: 400 },
      });
    }

    const clientId = req.clientId || 'generic';
    const folder = `ai-posters/tenants/${clientId}/poster-images`;

    const uploadResult = await storageService.uploadBuffer(req.file.buffer, {
      folder,
      filename: `poster_img_${Date.now()}`,
      mimetype: req.file.mimetype,
    });

    res.status(200).json({
      success: true,
      data: {
        url: uploadResult.secure_url || uploadResult.url,
        secure_url: uploadResult.secure_url,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Sign a direct browser -> Cloudinary upload for brand artwork. No image bytes
 * pass through this server, and the target folder is locked to this tenant.
 */
export async function signBrandImageUpload(req, res, next) {
  try {
    if (!req.clientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Choose an organization before uploading brand artwork.', status: 400 },
      });
    }

    const signed = await storageService.signDirectUpload({ folder: brandImageFolder(req.clientId) });
    if (!signed) {
      return res.status(503).json({
        success: false,
        error: { message: 'Image storage is not connected yet. Please contact an administrator.', status: 503 },
      });
    }

    const limit = await consumeRateLimit({
      key: `brand-sign:${req.user._id}`,
      limit: SIGNATURE_LIMIT_PER_HOUR,
      windowMs: SIGN_WINDOW_MS,
    });
    if (!limit.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          message: `You have requested too many upload links. Try again in ${limit.retryAfterMinutes} minutes.`,
          status: 429,
        },
      });
    }

    return res.status(200).json({ success: true, data: signed });
  } catch (err) {
    return next(err);
  }
}
