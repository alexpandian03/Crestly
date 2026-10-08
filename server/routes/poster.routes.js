import express from 'express';
import {
  addPosterVersionController,
  applyLatestDesignController,
  createPosterController,
  deletePosterController,
  duplicatePosterController,
  generatePosterContentController,
  generatePosterImageController,
  getPosterController,
  listPostersController,
  restorePosterVersionController,
  updatePosterController,
  uploadPosterThumbnailController,
  searchPhotosController,
  trackPhotoDownloadController,
} from '../controllers/poster.controller.js';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { uploadThumbnailMiddleware } from '../middleware/upload.middleware.js';
import {
  createPosterSchema,
  applyLatestDesignSchema,
  generatePosterRequestSchema,
  posterIdParamsSchema,
  posterImageRequestSchema,
  posterListQuerySchema,
  regeneratePosterSchema,
  restorePosterSchema,
  updatePosterSchema,
} from '../validation/poster.schema.js';

const router = express.Router();

router.use(requireAuth, requireRole('superadmin', 'clientadmin', 'user'));

router.post(
  '/generate',
  tenantGuard,
  validateBody(generatePosterRequestSchema),
  generatePosterContentController
);

/* One illustration for a design that shows a picture: the only writer here that talks to a
   picture service, and it keeps its own daily count. */
router.post(
  '/image',
  tenantGuard,
  validateBody(posterImageRequestSchema),
  generatePosterImageController
);

router.post('/', tenantGuard, validateBody(createPosterSchema), createPosterController);
router.get('/', tenantGuard, validateQuery(posterListQuerySchema), listPostersController);
router.get('/photos/search', tenantGuard, searchPhotosController);
router.post('/photos/download', tenantGuard, trackPhotoDownloadController);
router.get('/:id', tenantGuard, validateParams(posterIdParamsSchema), getPosterController);

router.patch(
  '/:id',
  tenantGuard,
  validateParams(posterIdParamsSchema),
  validateBody(updatePosterSchema),
  updatePosterController
);

router.post(
  '/:id/versions',
  tenantGuard,
  validateParams(posterIdParamsSchema),
  validateBody(regeneratePosterSchema),
  addPosterVersionController
);

router.post(
  '/:id/restore',
  tenantGuard,
  validateParams(posterIdParamsSchema),
  validateBody(restorePosterSchema),
  restorePosterVersionController
);

router.post(
  '/:id/duplicate',
  tenantGuard,
  validateParams(posterIdParamsSchema),
  duplicatePosterController
);

router.post(
  '/:id/apply-latest-design',
  tenantGuard,
  validateParams(posterIdParamsSchema),
  validateBody(applyLatestDesignSchema),
  applyLatestDesignController
);

router.post(
  '/:id/thumbnail',
  tenantGuard,
  validateParams(posterIdParamsSchema),
  uploadThumbnailMiddleware,
  uploadPosterThumbnailController
);

router.delete('/:id', tenantGuard, validateParams(posterIdParamsSchema), deletePosterController);

export default router;
