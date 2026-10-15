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
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth.middleware.js';
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

/* Tidy my list: takes pasted text and card list definition and returns structured entries */
router.post(
  '/parse-list',
  tenantGuard,
  smallBody,
  validateBody(parseCardListSchema),
  parseCardListController
);

router.post('/', tenantGuard, validateBody(createPosterSchema), createPosterController);
router.get('/', tenantGuard, validateQuery(posterListQuerySchema), listPostersController);
router.get('/photos/search', tenantGuard, searchPhotosController);
router.post('/photos/download', tenantGuard, trackPhotoDownloadController);
router.get('/:id', tenantGuard, validateParams(posterIdParamsSchema), getPosterController);

router.put(
  '/:id/draft',
  tenantGuard,
  smallBody,
  validateParams(posterIdParamsSchema),
  validateBody(posterDraftSchema),
  autosavePosterDraftController
);
router.get(
  '/:id/draft',
  tenantGuard,
  validateParams(posterIdParamsSchema),
  getPosterDraftController
);
router.delete(
  '/:id/draft',
  tenantGuard,
  validateParams(posterIdParamsSchema),
  discardPosterDraftController
);

router.patch(
  '/:id',
  tenantGuard,
  smallBody,
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
