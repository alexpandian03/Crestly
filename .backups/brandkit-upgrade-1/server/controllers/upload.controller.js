import storageService from '../services/storage.js';

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
