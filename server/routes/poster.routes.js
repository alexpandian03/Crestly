import express from 'express';
import {
  addPosterVersionController,
  applyLatestDesignController,
  autosavePosterDraftController,
  createPosterController,
  deletePosterController,
  discardPosterDraftController,
  duplicatePosterController,
  generatePosterContentController,
  generatePosterImageController,
  getPosterController,
  getPosterDraftController,
  listPostersController,
  restorePosterVersionController,
  updatePosterController,
  uploadPosterThumbnailController,
  searchPhotosController,
  trackPhotoDownloadController,
  parseCardListController,
} from '../controllers/poster.controller.js';
import { requireAuth, requirePermission, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { uploadThumbnailMiddleware } from '../middleware/upload.middleware.js';
import {
  createPosterSchema,
  applyLatestDesignSchema,
  generatePosterRequestSchema,
  parseCardListSchema,
  posterDraftSchema,
  posterIdParamsSchema,
  posterImageRequestSchema,
  posterListQuerySchema,
  regeneratePosterSchema,
  restorePosterSchema,
  updatePosterSchema,
} from '../validation/poster.schema.js';

const router = express.Router();

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

router.use(requireAuth);

router.post(
  '/generate',
  requirePermission('posters:create'),
  tenantGuard,
  validateBody(generatePosterRequestSchema),
  generatePosterContentController
);

/* One illustration for a design that shows a picture: the only writer here that talks to a
   picture service, and it keeps its own daily count. */
router.post(
  '/image',
  requirePermission('posters:create'),
  tenantGuard,
  validateBody(posterImageRequestSchema),
  generatePosterImageController
);

/* Tidy my list: takes pasted text and card list definition and returns structured entries */
router.post(
  '/parse-list',
  requirePermission('posters:create'),
  tenantGuard,
  smallBody,
  validateBody(parseCardListSchema),
  parseCardListController
);

router.post('/', requirePermission('posters:create'), tenantGuard, smallBody, validateBody(createPosterSchema), createPosterController);
router.get('/', requirePermission('posters:read:own'), tenantGuard, validateQuery(posterListQuerySchema), listPostersController);
router.get('/photos/search', requirePermission('posters:create'), tenantGuard, searchPhotosController);
router.post('/photos/download', requirePermission('posters:create'), tenantGuard, trackPhotoDownloadController);
router.get('/:id', requirePermission('posters:read:own'), tenantGuard, validateParams(posterIdParamsSchema), getPosterController);

router.put(
  '/:id/draft',
  requirePermission('posters:create'),
  tenantGuard,
  smallBody,
  validateParams(posterIdParamsSchema),
  validateBody(posterDraftSchema),
  autosavePosterDraftController
);
router.get(
  '/:id/draft',
  requirePermission('posters:read:own'),
  tenantGuard,
  validateParams(posterIdParamsSchema),
  getPosterDraftController
);
router.delete(
  '/:id/draft',
  requirePermission('posters:create'),
  tenantGuard,
  validateParams(posterIdParamsSchema),
  discardPosterDraftController
);

router.patch(
  '/:id',
  requirePermission('posters:create'),
  tenantGuard,
  smallBody,
  validateParams(posterIdParamsSchema),
  validateBody(updatePosterSchema),
  updatePosterController
);

router.post(
  '/:id/versions',
  requirePermission('posters:create'),
  tenantGuard,
  validateParams(posterIdParamsSchema),
  validateBody(regeneratePosterSchema),
  addPosterVersionController
);

router.post(
  '/:id/restore',
  requirePermission('posters:create'),
  tenantGuard,
  validateParams(posterIdParamsSchema),
  validateBody(restorePosterSchema),
  restorePosterVersionController
);

router.post(
  '/:id/duplicate',
  requirePermission('posters:create'),
  tenantGuard,
  validateParams(posterIdParamsSchema),
  duplicatePosterController
);

router.post(
  '/:id/apply-latest-design',
  requirePermission('posters:create'),
  tenantGuard,
  validateParams(posterIdParamsSchema),
  validateBody(applyLatestDesignSchema),
  applyLatestDesignController
);

router.post(
  '/:id/thumbnail',
  requirePermission('posters:create'),
  tenantGuard,
  validateParams(posterIdParamsSchema),
  uploadThumbnailMiddleware,
  uploadPosterThumbnailController
);

router.delete('/:id', requirePermission('posters:delete'), tenantGuard, validateParams(posterIdParamsSchema), deletePosterController);

export default router;
