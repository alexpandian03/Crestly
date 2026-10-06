import express from 'express';
import {
  createClient,
  deactivateClient,
  getAllClients,
  getClientById,
  getOwnClient,
  updateClient,
} from '../controllers/client.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';
import { clientParamsSchema, createClientSchema, updateClientSchema } from '../validation/client.schema.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('superadmin'), getAllClients);
router.post('/', requireAuth, requireRole('superadmin'), validateBody(createClientSchema), createClient);
router.get('/me', requireAuth, requireRole('clientadmin', 'user'), getOwnClient);
router.get('/:id', requireAuth, validateParams(clientParamsSchema), getClientById);
router.patch('/:id', requireAuth, requireRole('superadmin'), validateParams(clientParamsSchema), validateBody(updateClientSchema), updateClient);
router.put('/:id', requireAuth, requireRole('superadmin'), validateParams(clientParamsSchema), validateBody(updateClientSchema), updateClient);
router.delete('/:id', requireAuth, requireRole('superadmin'), validateParams(clientParamsSchema), deactivateClient);

export default router;
