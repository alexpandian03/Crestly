import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import LoginAttempt from '../models/LoginAttempt.model.js';
import Session from '../models/Session.model.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long.');
}
const JWT_EXPIRES_IN = '15m';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const DUMMY_PASSWORD_HASH = '$2b$12$k6GsaPWHQdYyNJPuQKVnWOHyknQmHLHvsDE23n/.uRnGmRSiFjz7S';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function generateOpaqueToken() {
  return crypto.randomBytes(40).toString('hex');
}

import { canAssignRole, getPermissionsForRole } from '../../shared/permissions.js';
import { audit } from './audit.service.js';

export function publicUser(user) {
  const client = user.clientId && typeof user.clientId === 'object' ? user.clientId : null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    clientId: client?._id?.toString() || user.clientId?.toString() || null,
    clientName: client?.name || null,
    isActive: user.isActive,
    isEmailVerified: Boolean(user.isEmailVerified),
    mustChangePassword: Boolean(user.mustChangePassword),
    mfa: {
      enabled: Boolean(user.mfa?.enabled),
    },
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    permissions: getPermissionsForRole(user.role),
  };
}

export function generateToken(user, sessionId) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      clientId: user.clientId?._id?.toString() || user.clientId?.toString() || null,
      tokenVersion: user.tokenVersion || 0,
      sessionId: sessionId ? sessionId.toString() : undefined,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function getAttempt(email, ip) {
  const cutoff = new Date(Date.now() - LOGIN_WINDOW_MS);
  return LoginAttempt.findOne({ email, ip, windowStartedAt: { $gte: cutoff } });
}

async function recordFailure(email, ip) {
  const now = new Date();
  const attempt = await LoginAttempt.findOne({ email, ip });
  if (!attempt || attempt.windowStartedAt < new Date(now.getTime() - LOGIN_WINDOW_MS)) {
    await LoginAttempt.findOneAndUpdate(
      { email, ip },
      { email, ip, failedAttempts: 1, windowStartedAt: now, expiresAt: new Date(now.getTime() + LOGIN_WINDOW_MS) },
      { upsert: true, setDefaultsOnInsert: true }
    );
    return;
  }
  attempt.failedAttempts += 1;
  attempt.expiresAt = new Date(now.getTime() + LOGIN_WINDOW_MS);
  await attempt.save();
}

export async function loginUser({ email, password, ip, userAgent }) {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedIp = String(ip || 'unknown').slice(0, 128);
  const attempt = await getAttempt(normalizedEmail, normalizedIp);
  if (attempt?.failedAttempts >= MAX_FAILURES) {
    throw httpError(429, 'Too many attempts. Try again in a few minutes.');
  }

  const user = await User.findOne({ email: normalizedEmail })
    .select('+passwordHash')
    .populate('clientId', 'name isActive requireMfaForAdmins');
  const passwordMatches = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    await recordFailure(normalizedEmail, normalizedIp);
    throw httpError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw httpError(403, 'This account is inactive. Contact your administrator.');
  if (user.role !== 'superadmin' && (!user.clientId || !user.clientId.isActive)) {
    throw httpError(403, 'This organization is inactive. Contact your administrator.');
  }

  await Promise.all([
    User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }),
    LoginAttempt.deleteOne({ email: normalizedEmail, ip: normalizedIp }),
  ]);
  user.lastLoginAt = new Date();

  return createSessionForUser(user, { userAgent });
}

export async function createSessionForUser(user, { userAgent } = {}) {
  const familyId = crypto.randomUUID();
  const refreshToken = generateOpaqueToken();
  const tokenHash = hashToken(refreshToken);
  const now = new Date();

  let ttlMs = 30 * 24 * 60 * 60 * 1000;
  const sessionLength = user.clientId?.sessionLength;
  if (sessionLength === '8h') {
    ttlMs = 8 * 60 * 60 * 1000;
  } else if (sessionLength === '7d') {
    ttlMs = 7 * 24 * 60 * 60 * 1000;
  } else if (sessionLength === '30d') {
    ttlMs = 30 * 24 * 60 * 60 * 1000;
  }
  const expiresAt = new Date(now.getTime() + ttlMs);

  const session = await Session.create({
    userId: user._id,
    clientId: user.clientId?._id || user.clientId || null,
    tokenHash,
    familyId,
    userAgent: String(userAgent || '').slice(0, 500),
    createdAt: now,
    lastUsedAt: now,
    expiresAt,
  });

  const accessToken = generateToken(user, session._id);

  return {
    accessToken,
    refreshToken,
    expiresAt,
    user: publicUser(user),
    token: accessToken,
  };
}

export async function rotateRefreshToken(rawRefreshToken, { userAgent } = {}) {
  if (!rawRefreshToken) {
    throw httpError(401, 'Refresh token required');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const session = await Session.findOne({ tokenHash });

  if (!session) {
    throw httpError(401, 'Invalid or expired session. Please log in again.');
  }

  // Token reuse detection!
  // If session is already revoked or replacedBy is set, an old token is being reused!
  if (session.revokedAt || session.replacedBy) {
    await audit(
      null,
      'auth.token_reuse',
      { type: 'Session', id: session._id },
      {
        result: 'failure',
        clientId: session.clientId,
        actorId: session.userId,
        meta: { familyId: session.familyId },
      }
    );
    await Session.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw httpError(401, 'Session violation detected. Please log in again.');
  }

  // Expiration check (30-day absolute and 7-day idle expiry)
  const now = Date.now();
  const isAbsoluteExpired = now > new Date(session.expiresAt).getTime();
  const isIdleExpired = now - new Date(session.lastUsedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
  if (isAbsoluteExpired || isIdleExpired) {
    session.revokedAt = new Date();
    await session.save();
    throw httpError(401, 'Session expired. Please log in again.');
  }

  const user = await User.findById(session.userId).populate('clientId', 'name isActive');
  if (!user || !user.isActive) {
    session.revokedAt = new Date();
    await session.save();
    throw httpError(401, 'This account is inactive. Contact your administrator.');
  }
  if (user.role !== 'superadmin' && (!user.clientId || !user.clientId.isActive)) {
    session.revokedAt = new Date();
    await session.save();
    throw httpError(401, 'This organization is inactive. Contact your administrator.');
  }

  // Rotate token: create new session record in same family
  const newRefreshToken = generateOpaqueToken();
  const newTokenHash = hashToken(newRefreshToken);

  const newSession = await Session.create({
    userId: user._id,
    clientId: user.clientId?._id || user.clientId || null,
    tokenHash: newTokenHash,
    familyId: session.familyId,
    userAgent: String(userAgent || session.userAgent || '').slice(0, 500),
    createdAt: session.createdAt,
    lastUsedAt: new Date(),
    expiresAt: session.expiresAt,
  });

  session.revokedAt = new Date();
  session.replacedBy = newSession._id;
  await session.save();

  const newAccessToken = generateToken(user, newSession._id);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: session.expiresAt,
    user: publicUser(user),
    session: newSession,
    token: newAccessToken,
  };
}

export async function revokeSession({ sessionId, refreshToken }) {
  if (sessionId) {
    await Session.updateOne({ _id: sessionId }, { $set: { revokedAt: new Date() } });
  } else if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await Session.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
  }
}

export async function revokeAllUserSessions(userId) {
  await Promise.all([
    Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }),
    User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }),
  ]);
}


export async function changeUserPassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw httpError(400, 'Current password is incorrect');
  }
  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
}

export async function createUser({ name, email, password, role, clientId, actor }) {
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.exists({ email: normalizedEmail })) {
    throw httpError(409, 'That email is already in use');
  }
  if (role === 'superadmin') throw httpError(403, 'Superadmin accounts can only be created by the seed script.');
  if (!canAssignRole(actor.role, role)) throw httpError(403, 'You cannot grant a role above your own permissions.');

  let assignedClientId;
  if (actor.role === 'superadmin') {
    assignedClientId = clientId;
  } else if (actor.role === 'clientadmin') {
    assignedClientId = actor.clientId?._id || actor.clientId;
  } else {
    throw httpError(403, "You don't have access to this action.");
  }

  const client = await Client.findOne({ _id: assignedClientId, isActive: true }).select('_id');
  if (!client) throw httpError(400, 'Choose an active organization for this user.');

  try {
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await User.hashPassword(password),
      role,
      clientId: client._id,
      isActive: true,
      mustChangePassword: false,
      createdBy: actor._id,
    });
    await user.populate('clientId', 'name isActive');
    return publicUser(user);
  } catch (err) {
    if (err?.code === 11000) throw httpError(409, 'That email is already in use');
    throw err;
  }
}
