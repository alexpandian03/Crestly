import express from 'express';
import { getBrandKit, updateBrandKit } from '../controllers/brandKit.controller.js';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { updateBrandKitSchema } from '../validation/brandKit.schema.js';

const router = express.Router();

// Read brand kit: any authenticated user in the tenant
router.get('/', requireAuth, tenantGuard, getBrandKit);

// Modify brand kit: clientadmin and superadmin only, with schema validation
router.put(
  '/',
  requireAuth,
  requireRole('superadmin', 'clientadmin'),
  tenantGuard,
  validateBody((req) => updateBrandKitSchema({ clientId: req.clientId })),
  updateBrandKit
);

export default router;
