import express from 'express';
import {
  createNewUser,
  deactivateUser,
  getInvites,
  getUsers,
  inviteUser,
  resendInvite,
  resetUserPassword,
  resetUserMfa,
  revokeInvite,
  updateUser,
} from '../controllers/user.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userParamsSchema,
} from '../validation/user.schema.js';

const router = express.Router();

router.get('/', requireAuth, requirePermission('users:read'), validateQuery(listUsersQuerySchema), getUsers);
router.post('/', requireAuth, requirePermission('users:create'), validateBody(createUserSchema), createNewUser);
router.patch('/:id', requireAuth, requirePermission('users:write'), validateParams(userParamsSchema), validateBody(updateUserSchema), updateUser);
router.delete('/:id', requireAuth, requirePermission('users:deactivate'), validateParams(userParamsSchema), deactivateUser);
router.post('/:id/reset-password', requireAuth, requirePermission('users:write'), validateParams(userParamsSchema), resetUserPassword);
router.post('/:id/reset-mfa', requireAuth, requirePermission('users:write'), validateParams(userParamsSchema), resetUserMfa);

// Invites
router.post('/invite', requireAuth, requirePermission('users:invite'), inviteUser);
router.get('/invites', requireAuth, requirePermission('users:read'), getInvites);
router.post('/invites/:id/resend', requireAuth, requirePermission('users:invite'), resendInvite);
router.delete('/invites/:id', requireAuth, requirePermission('users:deactivate'), revokeInvite);

export default router;
