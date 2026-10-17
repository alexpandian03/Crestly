import crypto from 'crypto';
import Token from '../models/Token.model.js';

export const TOKEN_EXPIRIES = {
  invite: 7 * 24 * 60 * 60 * 1000, // 7 days
  reset: 30 * 60 * 1000, // 30 minutes
  verify: 24 * 60 * 60 * 1000, // 24 hours
  'email-change': 24 * 60 * 60 * 1000, // 24 hours
  mfa: 5 * 60 * 1000, // 5 minutes (single use)
};

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createToken({ type, userId, email, clientId, role }) {
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const duration = TOKEN_EXPIRIES[type] || 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + duration);

  const tokenDoc = await Token.create({
    type,
    userId: userId || null,
    email: email ? email.toLowerCase().trim() : null,
    clientId: clientId || null,
    role: role || null,
    tokenHash,
    expiresAt,
    usedAt: null,
  });

  return { rawToken, tokenDoc };
}

export async function peekToken({ rawToken, type }) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw httpError(400, 'Token is required');
  }

  const tokenHash = hashToken(rawToken);
  const filter = { tokenHash };
  if (type) filter.type = type;

  const tokenDoc = await Token.findOne(filter);
  if (!tokenDoc) {
    throw httpError(400, 'Invalid or expired token.');
  }

  if (tokenDoc.usedAt) {
    throw httpError(400, 'This token has already been used.');
  }

  if (Date.now() > new Date(tokenDoc.expiresAt).getTime()) {
    throw httpError(400, 'This token has expired.');
  }

  return tokenDoc;
}

export async function verifyAndConsumeToken({ rawToken, type }) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw httpError(400, 'Token is required');
  }

  const tokenHash = hashToken(rawToken);
  const filter = { tokenHash };
  if (type) filter.type = type;

  const tokenDoc = await Token.findOne(filter);
  if (!tokenDoc) {
    throw httpError(400, 'Invalid or expired token.');
  }

  if (tokenDoc.usedAt) {
    throw httpError(400, 'This token has already been used.');
  }

  if (Date.now() > new Date(tokenDoc.expiresAt).getTime()) {
    throw httpError(400, 'This token has expired.');
  }

  tokenDoc.usedAt = new Date();
  await tokenDoc.save();

  return tokenDoc;
}

export async function revokeTokenById(tokenId) {
  return Token.findByIdAndUpdate(tokenId, { $set: { usedAt: new Date() } }, { new: true });
}
