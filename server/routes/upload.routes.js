import express from 'express';
import { signBrandImageUpload, uploadLogo, uploadPosterImage } from '../controllers/upload.controller.js';
import { uploadLogoMiddleware, uploadPosterImageMiddleware } from '../middleware/upload.middleware.js';
import { requireAuth, requirePermission, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { brandImageSignSchema } from '../validation/brandKit.schema.js';

const router = express.Router();

// Logo upload — clientadmin and superadmin (brandkit:write)
router.post(
  '/logo',
  requireAuth,
  requirePermission('brandkit:write'),
  tenantGuard,
  uploadLogoMiddleware,
  uploadLogo
);

// Poster content image upload — any authenticated tenant user (posters:create)
router.post(
  '/image',
  requireAuth,
  requirePermission('posters:create'),
  tenantGuard,
  uploadPosterImageMiddleware,
  uploadPosterImage
);

// Direct browser upload signature for brand artwork - clientadmin and superadmin (brandkit:write)
router.post(
  '/brand-image/sign',
  requireAuth,
  requirePermission('brandkit:write'),
  tenantGuard,
  validateBody(brandImageSignSchema),
  signBrandImageUpload
);

export default router;
