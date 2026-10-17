import crypto from 'crypto';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import Token from '../models/Token.model.js';
import { createUser, publicUser } from '../services/auth.service.js';
import { scopedFilter } from '../middleware/auth.middleware.js';
import { createToken, hashToken } from '../services/token.service.js';
import { sendInviteEmail } from '../services/mail.service.js';

import { canAssignRole } from '../../shared/permissions.js';
import { audit } from '../services/audit.service.js';
import { requireStepUpIfMfa, verifyStepUpAuth } from '../services/mfa.service.js';
import { sendMfaResetEmail } from '../services/mail.service.js';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sameId(left, right) {
  return String(left?._id || left) === String(right?._id || right);
}

async function targetForActor(req) {
  const target = await User.findById(req.params.id).populate('clientId', 'name isActive');
  if (!target) throw httpError(404, 'User not found');
  if (req.user.role === 'clientadmin') {
    if (target.role === 'superadmin' || !sameId(target.clientId, req.user.clientId)) {
      throw httpError(403, "You don't have access to this user.");
    }
  }
  return target;
}

async function protectLastAdministrator(target, changes) {
  const deactivating = target.isActive && changes.isActive === false;
  const removingClientAdmin = target.role === 'clientadmin' && changes.role && changes.role !== 'clientadmin';
  if (target.role === 'superadmin' && deactivating) {
    const remaining = await User.countDocuments({ role: 'superadmin', isActive: true, _id: { $ne: target._id } });
    if (remaining === 0) throw httpError(400, 'The last active superadmin cannot be deactivated.');
  }
  if (target.role === 'clientadmin' && (deactivating || removingClientAdmin)) {
    const clientId = target.clientId?._id || target.clientId;
    const remaining = await User.countDocuments({
      clientId,
      role: 'clientadmin',
      isActive: true,
      _id: { $ne: target._id },
    });
    if (remaining === 0) throw httpError(400, 'The last active client administrator cannot be removed or demoted.');
  }
}

export async function getUsers(req, res, next) {
  try {
    let filter = {};
    if (req.user.role === 'clientadmin') {
      req.clientId = req.user.clientId?._id || req.user.clientId;
      filter = scopedFilter(req);
    } else if (req.query.clientId) {
      const client = await Client.findById(req.query.clientId).select('_id');
      if (!client) throw httpError(400, 'The selected organization does not exist.');
      req.clientId = client._id;
      filter = scopedFilter(req);
    }

    const users = await User.find(filter).populate('clientId', 'name isActive').sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { users: users.map(publicUser) } });
  } catch (err) {
    return next(err);
  }
}

export async function createNewUser(req, res, next) {
  try {
    const user = await createUser({ ...req.body, actor: req.user });
    return res.status(201).json({ success: true, data: { user } });
  } catch (err) {
    return next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const target = await targetForActor(req);
    const changes = { ...req.body };

    if (target.role === 'superadmin') {
      if (changes.role !== undefined) throw httpError(403, 'Superadmin roles cannot be changed through the API.');
    } else if (changes.role === 'superadmin') {
      throw httpError(403, 'Superadmin roles cannot be assigned through the API.');
    }
    if (req.user.role === 'clientadmin') {
      if (changes.role !== undefined) throw httpError(403, 'Client administrators cannot change roles.');
      if (sameId(target._id, req.user._id) && changes.isActive === false) {
        throw httpError(400, 'You cannot deactivate your own account.');
      }
    }

    if (changes.isActive === false) {
      const actor = await User.findById(req.user._id).select('+passwordHash +mfa.secretEncrypted');
      await requireStepUpIfMfa(req, actor);
    }

    await protectLastAdministrator(target, changes);
    const oldRole = target.role;
    if (changes.name !== undefined) target.name = changes.name;
    if (changes.isActive !== undefined) target.isActive = changes.isActive;
    if (changes.role !== undefined) target.role = changes.role;
    await target.save();
    await target.populate('clientId', 'name isActive');

    if (changes.isActive === false) {
      await audit(req, 'user.deactivate', {
        targetType: 'user',
        targetId: target._id,
        meta: { email: target.email },
      });
    } else if (changes.role && changes.role !== oldRole) {
      await audit(req, 'user.role_change', {
        targetType: 'user',
        targetId: target._id,
        meta: { email: target.email, from: oldRole, to: target.role },
      });
    }

    return res.status(200).json({ success: true, data: { user: publicUser(target) } });
  } catch (err) {
    return next(err);
  }
}

export async function deactivateUser(req, res, next) {
  req.body = { isActive: false };
  return updateUser(req, res, next);
}

export async function resetUserPassword(req, res, next) {
  try {
    const target = await targetForActor(req);
    if (target.role === 'superadmin' && req.user.role !== 'superadmin') {
      throw httpError(403, "You don't have access to this user.");
    }
    const temporaryPassword = `${crypto.randomBytes(9).toString('base64url')}A1`;
    target.passwordHash = await User.hashPassword(temporaryPassword);
    target.mustChangePassword = true;
    await target.save();
    await target.populate('clientId', 'name isActive');

    await audit(req, 'auth.password_reset', {
      targetType: 'user',
      targetId: target._id,
      meta: { email: target.email, adminReset: true },
    });

    return res.status(200).json({
      success: true,
      data: { temporaryPassword, user: publicUser(target) },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/users/invite
 * Invites a user by email with role limited by caller permissions.
 * Role and clientId are stored in the server token.
 */
export async function inviteUser(req, res, next) {
  try {
    const { email, role = 'user', clientId } = req.body;
    if (role === 'superadmin') {
      throw httpError(403, 'Superadmin accounts can only be created by the seed script.');
    }
    if (!canAssignRole(req.user.role, role)) {
      throw httpError(403, 'You cannot grant a role above your own permissions.');
    }

    let assignedClientId;
    if (req.user.role === 'clientadmin') {
      assignedClientId = req.user.clientId?._id || req.user.clientId;
    } else if (req.user.role === 'superadmin') {
      assignedClientId = clientId;
    } else {
      throw httpError(403, "You don't have access to invite users.");
    }

    if (!assignedClientId) {
      throw httpError(400, 'Choose an organization for this invitation.');
    }

    const client = await Client.findOne({ _id: assignedClientId, isActive: true }).select('name allowedEmailDomains');
    if (!client) {
      throw httpError(400, 'Choose an active organization for this invitation.');
    }

    const normalizedEmail = String(email || '').toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw httpError(400, 'A valid email is required.');
    }

    if (Array.isArray(client.allowedEmailDomains) && client.allowedEmailDomains.length > 0) {
      const emailDomain = normalizedEmail.split('@')[1];
      if (!client.allowedEmailDomains.includes(emailDomain)) {
        throw httpError(
          400,
          `Invitations are restricted to the following email domain(s): ${client.allowedEmailDomains.join(', ')}`
        );
      }
    }

    if (await User.exists({ email: normalizedEmail })) {
      throw httpError(409, 'A user with that email already exists.');
    }

    // Invalidate any previous unconsumed invite for this email
    await Token.updateMany(
      { type: 'invite', email: normalizedEmail, usedAt: null },
      { $set: { usedAt: new Date(0) } }
    );

    const { rawToken, tokenDoc } = await createToken({
      type: 'invite',
      email: normalizedEmail,
      clientId: client._id,
      role,
    });

    await sendInviteEmail({
      email: normalizedEmail,
      orgName: client.name,
      rawToken,
    });

    await audit(req, 'user.invite', {
      targetType: 'user',
      targetId: tokenDoc._id,
      meta: { email: normalizedEmail, role, clientId: client._id },
    });

    return res.status(201).json({
      success: true,
      data: {
        message: 'Invitation sent successfully',
        invite: {
          id: tokenDoc._id.toString(),
          email: tokenDoc.email,
          role: tokenDoc.role,
          clientId: tokenDoc.clientId.toString(),
          expiresAt: tokenDoc.expiresAt,
          rawToken: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/users/invites
 * Lists pending invites for the actor's scope.
 */
export async function getInvites(req, res, next) {
  try {
    let filter = {
      type: 'invite',
      usedAt: null,
      expiresAt: { $gt: new Date() },
    };

    if (req.user.role === 'clientadmin') {
      filter.clientId = req.user.clientId?._id || req.user.clientId;
    } else if (req.query.clientId) {
      filter.clientId = req.query.clientId;
    }

    const tokens = await Token.find(filter)
      .populate('clientId', 'name')
      .sort({ createdAt: -1 });

    const invites = tokens.map((t) => ({
      id: t._id.toString(),
      email: t.email,
      role: t.role,
      clientId: t.clientId?._id?.toString() || t.clientId?.toString() || null,
      clientName: t.clientId?.name || null,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    }));

    return res.status(200).json({ success: true, data: { invites } });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/users/invites/:id/resend
 * Resends an existing unconsumed invitation.
 */
export async function resendInvite(req, res, next) {
  try {
    const tokenDoc = await Token.findById(req.params.id);
    if (!tokenDoc || tokenDoc.type !== 'invite' || tokenDoc.usedAt) {
      throw httpError(404, 'Invite not found or already consumed.');
    }

    if (req.user.role === 'clientadmin') {
      const actorClient = req.user.clientId?._id || req.user.clientId;
      if (String(tokenDoc.clientId) !== String(actorClient)) {
        throw httpError(403, "You don't have access to this invite.");
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    tokenDoc.tokenHash = hashToken(rawToken);
    tokenDoc.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await tokenDoc.save();

    const client = await Client.findById(tokenDoc.clientId).select('name');
    await sendInviteEmail({
      email: tokenDoc.email,
      orgName: client?.name,
      rawToken,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Invitation resent successfully',
        rawToken: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/users/invites/:id
 * Revokes a pending invitation.
 */
export async function revokeInvite(req, res, next) {
  try {
    const tokenDoc = await Token.findById(req.params.id);
    if (!tokenDoc || tokenDoc.type !== 'invite') {
      throw httpError(404, 'Invite not found.');
    }

    if (req.user.role === 'clientadmin') {
      const actorClient = req.user.clientId?._id || req.user.clientId;
      if (String(tokenDoc.clientId) !== String(actorClient)) {
        throw httpError(403, "You don't have access to this invite.");
      }
    }

    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    return res.status(200).json({
      success: true,
      data: { message: 'Invitation revoked successfully' },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/users/:id/reset-mfa
 * Admin can reset a user's MFA after a re-check, which is audited and emails the user.
 */
export async function resetUserMfa(req, res, next) {
  try {
    const target = await targetForActor(req);
    const actor = await User.findById(req.user._id).select('+passwordHash +mfa.secretEncrypted');
    await verifyStepUpAuth(req, actor);

    target.mfa = {
      enabled: false,
      secretEncrypted: undefined,
      tempSecretEncrypted: undefined,
      recoveryCodesHashed: [],
      lastUsedStep: 0,
    };
    await target.save();

    await audit(req, 'auth.mfa_reset', {
      targetType: 'user',
      targetId: target._id,
      meta: { email: target.email, resetBy: req.user.email },
    });

    await sendMfaResetEmail({ email: target.email, name: target.name }).catch((err) => {
      console.error('Failed to send MFA reset email:', err.message);
    });

    return res.status(200).json({
      success: true,
      data: { message: `MFA for ${target.email} has been reset.`, user: publicUser(target) },
    });
  } catch (err) {
    return next(err);
  }
}


