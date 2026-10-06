import express from 'express';
import {
  createNewUser,
  deactivateUser,
  getUsers,
  resetUserPassword,
  updateUser,
} from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userParamsSchema,
} from '../validation/user.schema.js';

const router = express.Router();

router.use(requireAuth, requireRole('superadmin', 'clientadmin'));
router.get('/', validateQuery(listUsersQuerySchema), getUsers);
router.post('/', validateBody(createUserSchema), createNewUser);
router.patch('/:id', validateParams(userParamsSchema), validateBody(updateUserSchema), updateUser);
router.delete('/:id', validateParams(userParamsSchema), deactivateUser);
router.post('/:id/reset-password', validateParams(userParamsSchema), resetUserPassword);

export default router;
