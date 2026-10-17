import crypto from 'crypto';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import Session from '../models/Session.model.js';
import AuditEvent from '../models/AuditEvent.model.js';
import {
  changeUserPassword,
  createSessionForUser,
  generateOpaqueToken,
  generateToken,
  hashToken,
  loginUser,
  publicUser,
  revokeAllUserSessions,
  revokeSession,
  rotateRefreshToken,
  verifyToken,
} from '../services/auth.service.js';
import { clearAuthCookies, setAuthCookies } from '../utils/cookies.js';
import { validatePassword } from '../utils/passwordPolicy.js';
import { createToken, peekToken, verifyAndConsumeToken } from '../services/token.service.js';
import {
  sendEmailChangeConfirmation,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../services/mail.service.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import { audit } from '../services/audit.service.js';
import {
  checkMfaRateLimit,
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  generateRecoveryCodes,
  getOtpauthUrl,
  verifyAndConsumeRecoveryCode,
  verifyStepUpAuth,
  verifyTotpCode,
} from '../services/mfa.service.js';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function login(req, res, next) {
  try {
    const result = await loginUser({
      email: req.body.email,
      password: req.body.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    });
    await audit(
      req,
      'auth.login',
      { type: 'User', id: result.user.id },
      {
        result: 'success',
        clientId: result.user.clientId,
        actorId: result.user.id,
        meta: { email: req.body.email },
      }
    );
    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        token: result.accessToken,
      },
    });
  } catch (err) {
    await audit(
      req,
      'auth.login',
      { type: 'User' },
      {
        result: 'failure',
        meta: { email: req.body.email, reason: err.message },
      }
    );
    return next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!rawRefreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: { message: 'Refresh token required', status: 401 },
      });
    }

    const result = await rotateRefreshToken(rawRefreshToken, {
      userAgent: req.headers['user-agent'],
    });

    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    });

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        token: result.accessToken,
      },
    });
  } catch (err) {
    clearAuthCookies(res);
    return next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    await revokeSession({
      sessionId: req.sessionId,
      refreshToken: rawRefreshToken,
    });
    await audit(req, 'auth.logout', { type: 'Session', id: req.sessionId });
    clearAuthCookies(res);
    return res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (err) {
    clearAuthCookies(res);
    return next(err);
  }
}

export async function logoutAll(req, res, next) {
  try {
    if (req.user?._id) {
      await revokeAllUserSessions(req.user._id);
      await audit(req, 'auth.logout', { type: 'User', id: req.user._id }, { meta: { all: true } });
    }
    clearAuthCookies(res);
    return res.status(200).json({
      success: true,
      data: { message: 'Logged out of all sessions' },
    });
  } catch (err) {
    clearAuthCookies(res);
    return next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = publicUser(req.user);
    return res.status(200).json({
      success: true,
      data: {
        user,
        permissions: user.permissions,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+passwordHash +mfa.secretEncrypted');
    if (!user) throw httpError(404, 'User not found.');
    await verifyStepUpAuth(req, user);

    const clientId = user.clientId?._id || user.clientId;
    const client = clientId ? await Client.findById(clientId).select('minPasswordLength') : null;
    const minLength = client?.minPasswordLength || 10;
    const check = validatePassword(req.body.newPassword, { minLength });
    if (!check.valid) {
      throw httpError(400, check.message);
    }
    await changeUserPassword(req.user._id, req.body.currentPassword, req.body.newPassword);
    await audit(req, 'auth.password_change', { type: 'User', id: req.user._id });
    return res.status(200).json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Rate limit per email and per IP in MongoDB.
 * Returns the exact same message for known and unknown emails.
 */
export async function forgotPassword(req, res, next) {
  try {
    const ip = req.ip || 'unknown';
    const normalizedEmail = String(req.body.email || '').toLowerCase().trim();

    const ipRate = await consumeRateLimit({
      key: `forgot-pw:ip:${ip}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipRate.allowed) {
      return res.status(429).json({
        success: false,
        error: { message: 'Too many password reset requests. Please try again later.', status: 429 },
      });
    }

    if (normalizedEmail) {
      const emailRate = await consumeRateLimit({
        key: `forgot-pw:email:${normalizedEmail}`,
        limit: 5,
        windowMs: 15 * 60 * 1000,
      });
      if (!emailRate.allowed) {
        return res.status(429).json({
          success: false,
          error: { message: 'Too many password reset requests. Please try again later.', status: 429 },
        });
      }
    }

    const user = await User.findOne({ email: normalizedEmail, isActive: true });
    if (user) {
      const { rawToken } = await createToken({
        type: 'reset',
        userId: user._id,
        email: user.email,
      });
      await sendPasswordResetEmail({ email: user.email, rawToken }).catch((err) => {
        console.error('Failed to send reset email:', err.message);
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'If an account exists with that email, a password reset link has been sent.',
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/reset-password
 * Validates password, consumes single-use reset token, updates password,
 * revokes all sessions, sends confirmation email.
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    const tokenDoc = await verifyAndConsumeToken({ rawToken: token, type: 'reset' });
    const user = await User.findById(tokenDoc.userId).select('+passwordHash');
    if (!user) {
      throw httpError(400, 'User not found.');
    }

    const client = user.clientId ? await Client.findById(user.clientId).select('minPasswordLength') : null;
    const minLength = client?.minPasswordLength || 10;
    const check = validatePassword(password, { minLength });
    if (!check.valid) {
      throw httpError(400, check.message);
    }

    user.passwordHash = await User.hashPassword(password);
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await revokeAllUserSessions(user._id);
    clearAuthCookies(res);
    await audit(req, 'auth.password_reset', user, {
      clientId: user.clientId,
      actorId: user._id,
      meta: { email: user.email },
    });

    await sendPasswordChangedEmail({ email: user.email }).catch((err) => {
      console.error('Failed to send password changed email:', err.message);
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Your password has been reset successfully. Please log in with your new password.',
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/auth/invite/:token
 * Validates invite token without consuming it, returns email & organization.
 */
export async function peekInvite(req, res, next) {
  try {
    const tokenDoc = await peekToken({ rawToken: req.params.token, type: 'invite' });
    const client = tokenDoc.clientId ? await Client.findById(tokenDoc.clientId).select('name') : null;
    return res.status(200).json({
      success: true,
      data: {
        email: tokenDoc.email,
        role: tokenDoc.role,
        clientName: client?.name || null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/accept-invite
 * Accepts invite: sets user's name and password.
 * Role and clientId are strictly taken from the server-stored token.
 */
export async function acceptInvite(req, res, next) {
  try {
    const { token, name, password } = req.body;

    const tokenDoc = await verifyAndConsumeToken({ rawToken: token, type: 'invite' });
    const client = tokenDoc.clientId ? await Client.findById(tokenDoc.clientId).select('minPasswordLength') : null;
    const minLength = client?.minPasswordLength || 10;
    const check = validatePassword(password, { minLength });
    if (!check.valid) {
      throw httpError(400, check.message);
    }

    const normalizedEmail = tokenDoc.email.toLowerCase().trim();

    if (await User.exists({ email: normalizedEmail })) {
      throw httpError(409, 'A user with that email already exists.');
    }

    const user = await User.create({
      name: String(name || '').trim() || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      passwordHash: await User.hashPassword(password),
      role: tokenDoc.role,
      clientId: tokenDoc.clientId,
      isActive: true,
      isEmailVerified: true,
      mustChangePassword: false,
    });

    await user.populate('clientId', 'name isActive');

    const familyId = crypto.randomUUID();
    const refreshToken = generateOpaqueToken();
    const tokenHash = hashToken(refreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const session = await Session.create({
      userId: user._id,
      clientId: user.clientId?._id || user.clientId || null,
      tokenHash,
      familyId,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
      createdAt: now,
      lastUsedAt: now,
      expiresAt,
    });

    const accessToken = generateToken(user, session._id);
    setAuthCookies(res, { accessToken, refreshToken, expiresAt });
    await audit(req, 'user.accept_invite', user, {
      clientId: user.clientId?._id || user.clientId,
      actorId: user._id,
      meta: { email: user.email, role: user.role },
    });

    return res.status(201).json({
      success: true,
      data: {
        user: publicUser(user),
        token: accessToken,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/send-verification
 * Sends a verification email link to the logged-in user.
 */
export async function sendVerification(req, res, next) {
  try {
    if (req.user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        data: { message: 'Your email address is already verified.' },
      });
    }

    const { rawToken } = await createToken({
      type: 'verify',
      userId: req.user._id,
      email: req.user.email,
    });

    await sendVerificationEmail({ email: req.user.email, rawToken });

    return res.status(200).json({
      success: true,
      data: { message: 'A verification link has been sent to your email address.' },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/verify-email
 * Consumes single-use verify token, marks user as email verified.
 */
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    const tokenDoc = await verifyAndConsumeToken({ rawToken: token, type: 'verify' });
    await User.updateOne({ _id: tokenDoc.userId }, { $set: { isEmailVerified: true } });
    return res.status(200).json({
      success: true,
      data: { message: 'Your email address has been verified successfully.' },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/request-email-change
 * Requests email change: verifies current password, stores pendingEmail, sends confirmation.
 */
export async function requestEmailChange(req, res, next) {
  try {
    const { newEmail } = req.body;
    const user = await User.findById(req.user._id).select('+passwordHash +mfa.secretEncrypted');
    if (!user) throw httpError(404, 'User not found.');

    await verifyStepUpAuth(req, user);

    const normalizedNewEmail = String(newEmail || '').toLowerCase().trim();
    if (!normalizedNewEmail || !normalizedNewEmail.includes('@')) {
      throw httpError(400, 'Provide a valid email address.');
    }
    if (await User.exists({ email: normalizedNewEmail, _id: { $ne: user._id } })) {
      throw httpError(409, 'That email address is already in use.');
    }

    user.pendingEmail = normalizedNewEmail;
    await user.save();

    const { rawToken } = await createToken({
      type: 'email-change',
      userId: user._id,
      email: normalizedNewEmail,
    });

    await sendEmailChangeConfirmation({ newEmail: normalizedNewEmail, rawToken });

    return res.status(200).json({
      success: true,
      data: { message: 'A confirmation link has been sent to your new email address.' },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/confirm-email-change
 * Consumes email-change token, updates email, marks verified.
 */
export async function confirmEmailChange(req, res, next) {
  try {
    const { token } = req.body;
    const tokenDoc = await verifyAndConsumeToken({ rawToken: token, type: 'email-change' });
    await User.updateOne(
      { _id: tokenDoc.userId },
      {
        $set: {
          email: tokenDoc.email,
          pendingEmail: null,
          isEmailVerified: true,
        },
      }
    );
    return res.status(200).json({
      success: true,
      data: { message: 'Your email address has been updated successfully.' },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/mfa/verify
 * Body: { mfaToken, code, recoveryCode }
 */
export async function verifyMfa(req, res, next) {
  try {
    const { mfaToken, code, recoveryCode } = req.body || {};
    if (!mfaToken) {
      throw httpError(400, 'MFA session token is required.');
    }

    const tokenDoc = await peekToken({ rawToken: mfaToken, type: 'mfa' });
    const user = await User.findById(tokenDoc.userId).select(
      '+passwordHash +mfa.secretEncrypted +mfa.recoveryCodesHashed +mfa.lastUsedStep'
    );
    if (!user || !user.isActive) {
      throw httpError(401, 'User account is inactive or not found.');
    }

    const rateCheck = await checkMfaRateLimit(user._id);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: { message: 'Too many failed MFA attempts. Please try again later.', status: 429 },
      });
    }

    let verified = false;
    if (recoveryCode) {
      verified = await verifyAndConsumeRecoveryCode(user._id, recoveryCode);
      if (!verified) {
        throw httpError(400, 'Invalid recovery code.');
      }
    } else if (code) {
      if (!user.mfa?.secretEncrypted) {
        throw httpError(400, 'MFA is not enabled for this account.');
      }
      const secret = decryptMfaSecret(user.mfa.secretEncrypted);
      const verification = verifyTotpCode(secret, code, {
        lastUsedStep: user.mfa.lastUsedStep || 0,
        window: 1,
      });
      if (!verification.valid) {
        if (verification.reason === 'replayed') {
          throw httpError(400, 'Authentication code has already been used.');
        }
        throw httpError(400, 'Invalid authentication code.');
      }
      await User.updateOne({ _id: user._id }, { $set: { 'mfa.lastUsedStep': verification.step } });
      verified = true;
    } else {
      throw httpError(400, 'Verification code or recovery code is required.');
    }

    // Single-use token: consume it now
    await verifyAndConsumeToken({ rawToken: mfaToken, type: 'mfa' });

    await user.populate('clientId', 'name isActive requireMfaForAdmins');
    const session = await createSessionForUser(user, {
      userAgent: req.headers['user-agent'],
    });

    setAuthCookies(res, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
    });

    await audit(
      req,
      'auth.login',
      { type: 'User', id: user._id },
      {
        result: 'success',
        clientId: user.clientId?._id || user.clientId,
        actorId: user._id,
        meta: { email: user.email, mfa: true, recoveryCodeUsed: Boolean(recoveryCode) },
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        user: publicUser(user),
        token: session.accessToken,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function resolveUserFromReq(req) {
  if (req.user) return req.user;

  // Try accessToken from cookies or Bearer header
  let token = req.cookies?.accessToken;
  const authHeader = req.headers?.authorization;
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (token) {
    try {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);
      if (user?.isActive) return user;
    } catch {}
  }

  // Try mfaToken from body or header
  const mfaToken = req.body?.mfaToken || req.headers?.['x-mfa-token'];
  if (mfaToken) {
    try {
      const tokenDoc = await peekToken({ rawToken: mfaToken, type: 'mfa' });
      const user = await User.findById(tokenDoc.userId);
      if (user?.isActive) return user;
    } catch {}
  }

  return null;
}

/**
 * POST /api/auth/mfa/setup
 * Generates new secret and returns plaintext secret + otpauth URL.
 */
export async function setupMfa(req, res, next) {
  try {
    const user = await resolveUserFromReq(req);
    if (!user) {
      throw httpError(401, 'Authentication required to setup MFA.');
    }

    const secret = generateMfaSecret();
    const tempSecretEncrypted = encryptMfaSecret(secret);
    await User.updateOne(
      { _id: user._id },
      { $set: { 'mfa.tempSecretEncrypted': tempSecretEncrypted } }
    );

    const otpauthUrl = getOtpauthUrl(user.email, secret, 'PosterAI');
    return res.status(200).json({
      success: true,
      data: {
        secret,
        otpauthUrl,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/mfa/confirm
 * Body: { code, mfaToken }
 * Verifies code against tempSecret, enables MFA, returns 10 recovery codes once.
 */
export async function confirmMfa(req, res, next) {
  try {
    const { code } = req.body || {};
    if (!code) {
      throw httpError(400, 'Verification code is required.');
    }

    const baseUser = await resolveUserFromReq(req);
    if (!baseUser) {
      throw httpError(401, 'Authentication required.');
    }

    const user = await User.findById(baseUser._id).select('+mfa.tempSecretEncrypted');
    const mfaToken = req.body?.mfaToken || req.headers?.['x-mfa-token'];

    if (!user.mfa?.tempSecretEncrypted) {
      throw httpError(400, 'MFA setup has not been initiated.');
    }

    const secret = decryptMfaSecret(user.mfa.tempSecretEncrypted);
    const verification = verifyTotpCode(secret, code, { window: 1 });
    if (!verification.valid) {
      throw httpError(400, 'Invalid verification code.');
    }

    const { rawCodes, hashedCodes } = generateRecoveryCodes(10);
    user.mfa.enabled = true;
    user.mfa.secretEncrypted = user.mfa.tempSecretEncrypted;
    user.mfa.tempSecretEncrypted = undefined;
    user.mfa.recoveryCodesHashed = hashedCodes;
    user.mfa.lastUsedStep = mfaToken ? verification.step : 0;
    await user.save();

    let sessionData = null;
    if (mfaToken) {
      await verifyAndConsumeToken({ rawToken: mfaToken, type: 'mfa' });
      await user.populate('clientId', 'name isActive requireMfaForAdmins');
      const session = await createSessionForUser(user, {
        userAgent: req.headers['user-agent'],
      });
      setAuthCookies(res, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      });
      sessionData = {
        user: publicUser(user),
        token: session.accessToken,
      };
    }

    await audit(
      req,
      'auth.mfa',
      { type: 'User', id: user._id },
      {
        result: 'success',
        clientId: user.clientId?._id || user.clientId,
        actorId: user._id,
        meta: { action: 'enabled' },
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        message: 'MFA enabled successfully. Store these recovery codes securely; they will not be shown again.',
        recoveryCodes: rawCodes,
        ...(sessionData || {}),
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/mfa/disable
 * Disables MFA after step-up verification.
 */
export async function disableMfa(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+passwordHash +mfa.secretEncrypted');
    if (!user) throw httpError(404, 'User not found.');

    await verifyStepUpAuth(req, user);

    user.mfa = {
      enabled: false,
      secretEncrypted: undefined,
      tempSecretEncrypted: undefined,
      recoveryCodesHashed: [],
      lastUsedStep: 0,
    };
    await user.save();

    await audit(
      req,
      'auth.mfa',
      { type: 'User', id: user._id },
      {
        result: 'success',
        clientId: user.clientId?._id || user.clientId,
        actorId: user._id,
        meta: { action: 'disabled' },
      }
    );

    return res.status(200).json({
      success: true,
      data: { message: 'MFA has been disabled.' },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/auth/security (and /api/auth/sessions)
 * Returns MFA status, active sessions (with isCurrent device flag), and recent sign-ins.
 */
export async function getUserSecurityInfo(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) throw httpError(404, 'User not found');

    const now = new Date();
    const [activeSessions, recentAudits] = await Promise.all([
      Session.find({
        userId: user._id,
        revokedAt: null,
        expiresAt: { $gt: now },
      }).sort({ lastUsedAt: -1 }),
      AuditEvent.find({
        action: 'auth.login',
        actorId: user._id,
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const currentSessionId = req.sessionId ? String(req.sessionId) : null;
    const sessions = activeSessions.map((s) => ({
      id: s._id.toString(),
      userAgent: s.userAgent || 'Unknown device',
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      isCurrent: currentSessionId ? String(s._id) === currentSessionId : false,
    }));

    const recentSignIns = recentAudits.map((a) => ({
      id: a._id.toString(),
      createdAt: a.createdAt,
      userAgent: a.userAgent || 'Unknown browser',
      ipHash: a.ipHash,
      result: a.result,
      recoveryCodeUsed: Boolean(a.meta?.recoveryCodeUsed),
    }));

    return res.status(200).json({
      success: true,
      data: {
        mfa: {
          enabled: false,
        },
        mfaEnabled: false,
        sessions,
        recentSignIns,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/auth/sessions/:id
 * Revokes an individual active session belonging to the user.
 */
export async function revokeUserSession(req, res, next) {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.user._id,
      revokedAt: null,
    });

    if (!session) {
      throw httpError(404, 'Session not found or already revoked.');
    }

    session.revokedAt = new Date();
    await session.save();

    await audit(
      req,
      'auth.session_revoke',
      { type: 'Session', id: session._id },
      {
        meta: { userAgent: session.userAgent },
      }
    );

    const isCurrent = req.sessionId && String(session._id) === String(req.sessionId);
    if (isCurrent) {
      clearAuthCookies(res);
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'Device session signed out successfully.',
        isCurrent,
      },
    });
  } catch (err) {
    return next(err);
  }
}


