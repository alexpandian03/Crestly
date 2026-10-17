import express from 'express';
import {
  signAssetUpload,
  createAsset,
  getAssets,
  deleteAsset,
} from '../controllers/asset.controller.js';
import { requireAuth, requirePermission, tenantGuard } from '../middleware/auth.middleware.js';

const router = express.Router();

// Direct browser upload signature limited to this tenant's brand and posters folders
router.post('/sign', requireAuth, requirePermission('assets:create'), tenantGuard, signAssetUpload);

// Register an uploaded asset
router.post('/', requireAuth, requirePermission('assets:create'), tenantGuard, createAsset);

// Paginated asset library (search by name, newest first)
router.get('/', requireAuth, requirePermission('assets:read'), tenantGuard, getAssets);

// Soft delete asset (clientadmin and superadmin)
router.delete('/:id', requireAuth, requirePermission('assets:delete'), tenantGuard, deleteAsset);

export default router;
