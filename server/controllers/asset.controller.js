import Asset from '../models/Asset.model.js';
import storageService from '../services/storage.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import { scopedFilter } from '../middleware/auth.middleware.js';

const SIGN_LIMIT_PER_HOUR = 60;
const SIGN_WINDOW_MS = 60 * 60 * 1000;
const CREATE_LIMIT_PER_HOUR = 120;

/**
 * Signs a direct browser -> Cloudinary upload limited to this client's folders
 * brand/<clientId> and posters/<clientId>. Never exposes the API secret.
 */
export async function signAssetUpload(req, res, next) {
  try {
    if (!req.clientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Choose an organization before uploading an image.', status: 400 },
      });
    }

    const clientId = String(req.clientId);
    const requested = typeof req.body?.folder === 'string' ? req.body.folder.trim() : '';

    let folder;
    if (!requested || requested === 'posters' || requested === `posters/${clientId}`) {
      folder = `posters/${clientId}`;
    } else if (requested === 'brand' || requested === `brand/${clientId}`) {
      folder = `brand/${clientId}`;
    } else {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Uploads must be directed to your organization\'s brand or posters folder.',
          status: 400,
        },
      });
    }

    const limit = await consumeRateLimit({
      key: `asset-sign:${req.user._id}`,
      limit: SIGN_LIMIT_PER_HOUR,
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

    const signed = await storageService.signDirectUpload({ folder });
    if (!signed) {
      return res.status(503).json({
        success: false,
        error: { message: 'Image storage is not connected yet. Please contact an administrator.', status: 503 },
      });
    }

    return res.status(200).json({ success: true, data: signed });
  } catch (err) {
    return next(err);
  }
}

/**
 * Registers an uploaded asset in this client's Cloudinary folder.
 * Never stores image bytes.
 */
export async function createAsset(req, res, next) {
  try {
    if (!req.clientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Choose an organization before registering an asset.', status: 400 },
      });
    }

    const limit = await consumeRateLimit({
      key: `asset-create:${req.user._id}`,
      limit: CREATE_LIMIT_PER_HOUR,
      windowMs: SIGN_WINDOW_MS,
    });
    if (!limit.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          message: `Too many images registered. Try again in ${limit.retryAfterMinutes} minutes.`,
          status: 429,
        },
      });
    }

    const { url, publicId, width, height, bytes, name } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Image web address is required.', status: 400 },
      });
    }

    const trimmedUrl = url.trim();

    // Base64 data URLs must be rejected
    if (trimmedUrl.startsWith('data:')) {
      return res.status(400).json({
        success: false,
        error: { message: 'Photos cannot be uploaded as raw data. Upload it to your image library first.', status: 400 },
      });
    }

    let parsed;
    try {
      parsed = new URL(trimmedUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: { message: 'Image web address must be a full valid URL.', status: 400 },
      });
    }

    if (parsed.protocol !== 'https:') {
      return res.status(400).json({
        success: false,
        error: { message: 'Image web address must use secure https.', status: 400 },
      });
    }

    if (parsed.hostname !== 'res.cloudinary.com' && !parsed.hostname.endsWith('cloudinary.com')) {
      return res.status(400).json({
        success: false,
        error: { message: 'Images must come from your organization\'s Cloudinary storage.', status: 400 },
      });
    }

    const clientIdStr = String(req.clientId);
    const isClientFolder =
      parsed.pathname.includes(`/brand/${clientIdStr}/`) ||
      parsed.pathname.includes(`/posters/${clientIdStr}/`) ||
      parsed.pathname.includes(`/tenants/${clientIdStr}/`);

    if (!isClientFolder) {
      return res.status(400).json({
        success: false,
        error: { message: 'The image does not belong to your organization\'s folder.', status: 400 },
      });
    }

    const assetName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : 'Untitled image';

    const asset = await Asset.create({
      clientId: req.clientId,
      url: trimmedUrl,
      publicId: typeof publicId === 'string' ? publicId.trim().slice(0, 200) : '',
      width: Math.max(0, parseInt(width, 10) || 0),
      height: Math.max(0, parseInt(height, 10) || 0),
      bytes: Math.max(0, parseInt(bytes, 10) || 0),
      createdBy: req.user._id,
      createdAt: new Date(),
      name: assetName,
    });

    return res.status(201).json({ success: true, data: asset });
  } catch (err) {
    return next(err);
  }
}

/**
 * Returns paginated assets for the tenant, newest first, with optional search by name.
 */
export async function getAssets(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const searchQuery = typeof req.query.name === 'string' ? req.query.name : typeof req.query.q === 'string' ? req.query.q : '';

    const filter = {
      clientId: req.clientId,
      isDeleted: { $ne: true },
    };

    if (searchQuery.trim()) {
      filter.name = {
        $regex: searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    }

    const [items, total] = await Promise.all([
      Asset.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Asset.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page,
        pages,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Soft deletes an asset (admin only).
 */
export async function deleteAsset(req, res, next) {
  try {
    const asset = await Asset.findOneAndUpdate(
      scopedFilter(req, { _id: req.params.id, isDeleted: { $ne: true } }),
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: { message: 'Asset not found', status: 404 },
      });
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Asset removed successfully' },
    });
  } catch (err) {
    return next(err);
  }
}
