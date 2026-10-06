import express from 'express';
import { signBrandImageUpload, uploadLogo, uploadPosterImage } from '../controllers/upload.controller.js';
import { uploadLogoMiddleware, uploadPosterImageMiddleware } from '../middleware/upload.middleware.js';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { brandImageSignSchema } from '../validation/brandKit.schema.js';

const router = express.Router();

// Logo upload — clientadmin and above
router.post(
  '/logo',
  requireAuth,
  requireRole('superadmin', 'clientadmin'),
  tenantGuard,
  uploadLogoMiddleware,
  uploadLogo
);

// Poster content image upload — any authenticated tenant user
router.post(
  '/image',
  requireAuth,
  tenantGuard,
  uploadPosterImageMiddleware,
  uploadPosterImage
);

// Direct browser upload signature for brand artwork - clientadmin and above
router.post(
  '/brand-image/sign',
  requireAuth,
  requireRole('superadmin', 'clientadmin'),
  tenantGuard,
  validateBody(brandImageSignSchema),
  signBrandImageUpload
);

export default router;
