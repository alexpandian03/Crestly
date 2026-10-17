import express from 'express';
import {
  createClient,
  deactivateClient,
  getAllClients,
  getClientById,
  getOwnClient,
  updateClient,
} from '../controllers/client.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';
import { clientParamsSchema, createClientSchema, updateClientSchema } from '../validation/client.schema.js';

const router = express.Router();

router.get('/', requireAuth, requirePermission('clients:manage'), getAllClients);
router.post('/', requireAuth, requirePermission('clients:manage'), validateBody(createClientSchema), createClient);
router.get('/me', requireAuth, requirePermission('clients:read:own'), getOwnClient);
router.get('/:id', requireAuth, requirePermission('clients:read:own'), validateParams(clientParamsSchema), getClientById);
// A client administrator may reach this route, but the controller keeps it to the design
// settings of its own organization; everything else stays superadmin-only.
router.patch('/:id', requireAuth, requirePermission('settings:write'), validateParams(clientParamsSchema), validateBody(updateClientSchema), updateClient);
router.put('/:id', requireAuth, requirePermission('clients:manage'), validateParams(clientParamsSchema), validateBody(updateClientSchema), updateClient);
router.delete('/:id', requireAuth, requirePermission('clients:manage'), validateParams(clientParamsSchema), deactivateClient);

export default router;
