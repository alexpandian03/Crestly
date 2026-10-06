import express from 'express';
import { changePassword, getMe, login } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { changePasswordSchema, loginSchema } from '../validation/auth.schema.js';

const router = express.Router();

router.post('/login', validateBody(loginSchema), login);
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, validateBody(changePasswordSchema), changePassword);

export default router;
