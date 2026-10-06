import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import LoginAttempt from '../models/LoginAttempt.model.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const DUMMY_PASSWORD_HASH = '$2b$12$k6GsaPWHQdYyNJPuQKVnWOHyknQmHLHvsDE23n/.uRnGmRSiFjz7S';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

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
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
  };
}

export function generateToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
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

export async function loginUser({ email, password, ip }) {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedIp = String(ip || 'unknown').slice(0, 128);
  const attempt = await getAttempt(normalizedEmail, normalizedIp);
  if (attempt?.failedAttempts >= MAX_FAILURES) {
    throw httpError(429, 'Too many attempts. Try again in a few minutes.');
  }

  const user = await User.findOne({ email: normalizedEmail })
    .select('+passwordHash')
    .populate('clientId', 'name isActive');
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

  return { token: generateToken(user), user: publicUser(user) };
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
