import express from 'express';
import { getAuditLogs, exportAuditLogsCsv } from '../controllers/audit.controller.js';
import { requireAuth, requirePermission, tenantGuard } from '../middleware/auth.middleware.js';

const router = express.Router();

// Both routes are read-only and guarded by audit:read permission.
// Superadmin sees all clients; clientadmin only their own organization.
router.get('/', requireAuth, requirePermission('audit:read'), getAuditLogs);
router.get('/export', requireAuth, requirePermission('audit:read'), exportAuditLogsCsv);

export default router;
