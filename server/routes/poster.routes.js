import express from 'express';
import {
  addPosterVersionController,
  applyLatestDesignController,
  autosavePosterDraftController,
  createPosterController,
  deletePosterController,
  discardPosterDraftController,
  duplicatePosterController,
  getPosterController,
  getPosterDraftController,
  listPostersController,
  restorePosterVersionController,
  updatePosterController,
  uploadPosterThumbnailController,
} from '../controllers/poster.controller.js';
import { generateHuggingFacePoster } from '../controllers/huggingFace.controller.js';
import { requireAuth, requirePermission, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { uploadThumbnailMiddleware } from '../middleware/upload.middleware.js';
import {
  addVersionSchema,
  applyLatestDesignSchema,
  createPosterSchema,
  posterDraftSchema,
  posterIdParamsSchema,
  posterListQuerySchema,
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

// Pure Hugging Face AI model poster generation routes (only Hugging Face AI model is used)
router.post('/generate-hf', generateHuggingFacePoster);
router.post('/generate', generateHuggingFacePoster);

router.use(requireAuth);

router.post('/', requirePermission('posters:create'), tenantGuard, smallBody, validateBody(createPosterSchema), createPosterController);
router.get('/', requirePermission('posters:read:own'), tenantGuard, validateQuery(posterListQuerySchema), listPostersController);
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
  validateBody(addVersionSchema),
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
