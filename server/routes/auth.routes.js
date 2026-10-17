import express from 'express';
import {
  acceptInvite,
  changePassword,
  confirmEmailChange,
  forgotPassword,
  getMe,
  login,
  logout,
  logoutAll,
  peekInvite,
  refresh,
  requestEmailChange,
  resetPassword,
  sendVerification,
  verifyEmail,
  verifyMfa,
  setupMfa,
  confirmMfa,
  disableMfa,
  getUserSecurityInfo,
  revokeUserSession,
} from '../controllers/auth.controller.js';
import { allowAnonymous, requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { changePasswordSchema, loginSchema } from '../validation/auth.schema.js';

const router = express.Router();

router.post('/login', allowAnonymous(), validateBody(loginSchema), login);
router.post('/refresh', allowAnonymous(), refresh);
router.post('/logout', allowAnonymous(), logout);
router.post('/logout-all', requireAuth, requirePermission('authenticated'), logoutAll);
router.get('/me', requireAuth, requirePermission('authenticated'), getMe);
router.post('/change-password', requireAuth, requirePermission('authenticated'), validateBody(changePasswordSchema), changePassword);

// Security & Sessions
router.get('/security', requireAuth, requirePermission('authenticated'), getUserSecurityInfo);
router.get('/sessions', requireAuth, requirePermission('authenticated'), getUserSecurityInfo);
router.delete('/sessions/:id', requireAuth, requirePermission('authenticated'), revokeUserSession);

// MFA Routes
router.post('/mfa/verify', allowAnonymous(), verifyMfa);
router.post('/mfa/setup', allowAnonymous(), setupMfa);
router.post('/mfa/confirm', allowAnonymous(), confirmMfa);
router.post('/mfa/disable', requireAuth, requirePermission('authenticated'), disableMfa);

// Password Reset
router.post('/forgot-password', allowAnonymous(), forgotPassword);
router.post('/reset-password', allowAnonymous(), resetPassword);

// Invites
router.get('/invite/:token', allowAnonymous(), peekInvite);
router.post('/accept-invite', allowAnonymous(), acceptInvite);

// Verification & Email Change
router.post('/send-verification', requireAuth, requirePermission('authenticated'), sendVerification);
router.post('/verify-email', allowAnonymous(), verifyEmail);
router.post('/request-email-change', requireAuth, requirePermission('authenticated'), requestEmailChange);
router.post('/confirm-email-change', allowAnonymous(), confirmEmailChange);

export default router;
