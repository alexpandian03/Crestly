import express from 'express';
import { uploadLogo, uploadPosterImage } from '../controllers/upload.controller.js';
import { uploadLogoMiddleware, uploadPosterImageMiddleware } from '../middleware/upload.middleware.js';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth.middleware.js';

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

export default router;
