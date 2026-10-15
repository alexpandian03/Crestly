import express from 'express';
import {
  signAssetUpload,
  createAsset,
  getAssets,
  deleteAsset,
} from '../controllers/asset.controller.js';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth.middleware.js';

const router = express.Router();

// Direct browser upload signature limited to this tenant's brand and posters folders
router.post('/sign', requireAuth, tenantGuard, signAssetUpload);

// Register an uploaded asset
router.post('/', requireAuth, tenantGuard, createAsset);

// Paginated asset library (search by name, newest first)
router.get('/', requireAuth, tenantGuard, getAssets);

// Soft delete asset (clientadmin and superadmin)
router.delete('/:id', requireAuth, requireRole('superadmin', 'clientadmin'), tenantGuard, deleteAsset);

export default router;
