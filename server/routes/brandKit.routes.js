import express from 'express';
import { getBrandKit, updateBrandKit } from '../controllers/brandKit.controller.js';
import { requireAuth, requirePermission, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { updateBrandKitSchema } from '../validation/brandKit.schema.js';

const router = express.Router();

/* The app accepts 4.5 MB overall; a brand kit is far smaller than that, so its own writes are
   capped well below it and a too-big save is refused instead of reaching the database. */
const MAX_BODY_BYTES = 1024 * 1024;

function smallBody(req, res, next) {
  const bytes = req.body ? Buffer.byteLength(JSON.stringify(req.body), 'utf8') : 0;
  if (bytes > MAX_BODY_BYTES) {
    return res.status(413).json({
      success: false,
      error: { message: 'That is too much to save at once. Remove a few items and try again.', status: 413 },
    });
  }
  return next();
}

// Read brand kit: any authenticated user in the tenant with brandkit:read
router.get('/', requireAuth, requirePermission('brandkit:read'), tenantGuard, getBrandKit);

// Modify brand kit: clientadmin and superadmin with brandkit:write, with schema validation
router.put(
  '/',
  requireAuth,
  requirePermission('brandkit:write'),
  tenantGuard,
  smallBody,
  validateBody((req) =>
    updateBrandKitSchema({ clientId: req.clientId, size: req.body?.defaultPosterSize })
  ),
  updateBrandKit
);

export default router;
