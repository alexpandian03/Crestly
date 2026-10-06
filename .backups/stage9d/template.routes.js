import express from 'express';
import {
  activateTemplate,
  createTemplate,
  deactivateTemplate,
  duplicateTemplate,
  getTemplateById,
  getTemplates,
  restoreTemplateVersion,
  updateTemplate,
} from '../controllers/template.controller.js';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';
import {
  createTemplateSchema,
  restoreTemplateSchema,
  templateParamsSchema,
  updateTemplateSchema,
} from '../validation/template.schema.js';

const router = express.Router();

const adminOnly = [requireAuth, requireRole('superadmin', 'clientadmin'), tenantGuard];

router.get('/', requireAuth, tenantGuard, getTemplates);
router.get('/:id', requireAuth, tenantGuard, validateParams(templateParamsSchema), getTemplateById);

router.post('/', adminOnly, validateBody(createTemplateSchema), createTemplate);
router.patch('/:id', adminOnly, validateParams(templateParamsSchema), validateBody(updateTemplateSchema), updateTemplate);
router.post('/:id/duplicate', adminOnly, validateParams(templateParamsSchema), duplicateTemplate);
router.post('/:id/activate', adminOnly, validateParams(templateParamsSchema), activateTemplate);
router.post('/:id/deactivate', adminOnly, validateParams(templateParamsSchema), deactivateTemplate);
router.post('/:id/restore', adminOnly, validateParams(templateParamsSchema), validateBody(restoreTemplateSchema), restoreTemplateVersion);

export default router;
