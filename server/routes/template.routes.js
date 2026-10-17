import express from 'express';
import {
  activateTemplate,
  autosaveTemplateDraft,
  createTemplate,
  deactivateTemplate,
  deleteTemplate,
  discardTemplateDraft,
  duplicateTemplate,
  getTemplateById,
  getTemplateDraft,
  getTemplates,
  restoreTemplateVersion,
  updateTemplate,
} from '../controllers/template.controller.js';
import { requireAuth, requirePermission, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';
import {
  createTemplateSchemaFor,
  restoreTemplateSchema,
  templateDraftSchemaFor,
  templateParamsSchema,
  updateTemplateSchemaFor,
} from '../validation/template.schema.js';

const router = express.Router();

const adminOnly = [requireAuth, requirePermission('templates:write'), tenantGuard];

/* The app accepts 4.5 MB overall; one template is far smaller than that, so its own writes
   are capped well below it and a too-big save is refused instead of reaching the database. */
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

router.get('/', requireAuth, requirePermission('templates:read'), tenantGuard, getTemplates);
router.get('/:id', requireAuth, requirePermission('templates:read'), tenantGuard, validateParams(templateParamsSchema), getTemplateById);

router.post('/', adminOnly, smallBody, validateBody(createTemplateSchemaFor), createTemplate);
router.patch(
  '/:id',
  adminOnly,
  validateParams(templateParamsSchema),
  smallBody,
  validateBody(updateTemplateSchemaFor),
  updateTemplate
);
router.put(
  '/:id/draft',
  adminOnly,
  smallBody,
  validateParams(templateParamsSchema),
  validateBody(templateDraftSchemaFor),
  autosaveTemplateDraft
);
router.get('/:id/draft', adminOnly, validateParams(templateParamsSchema), getTemplateDraft);
router.delete('/:id/draft', adminOnly, validateParams(templateParamsSchema), discardTemplateDraft);

router.post('/:id/duplicate', adminOnly, validateParams(templateParamsSchema), duplicateTemplate);
router.post('/:id/activate', adminOnly, validateParams(templateParamsSchema), activateTemplate);
router.post('/:id/deactivate', adminOnly, validateParams(templateParamsSchema), deactivateTemplate);
router.post('/:id/restore', adminOnly, validateParams(templateParamsSchema), validateBody(restoreTemplateSchema), restoreTemplateVersion);
router.delete('/:id', adminOnly, validateParams(templateParamsSchema), deleteTemplate);

export default router;
