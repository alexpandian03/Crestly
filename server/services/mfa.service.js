import crypto from 'crypto';
import User from '../models/User.model.js';
import { consumeRateLimit } from './rateLimit.js';

const B32_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Base32 encoding (RFC 4648) without padding
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += B32_CHARSET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += B32_CHARSET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 decoding (RFC 4648)
 */
export function base32Decode(input) {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const val = B32_CHARSET.indexOf(clean[i]);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Derives a 32-byte key from environment key for AES-256-GCM.
 */
function getEncryptionKey() {
  const raw = process.env.MFA_ENCRYPTION_KEY || 'brandframe-dev-mfa-encryption-key-32bytes';
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts MFA secret using AES-256-GCM.
 * Never logs the plain secret.
 */
export function encryptMfaSecret(plainSecret) {
  if (!plainSecret) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts MFA secret using AES-256-GCM.
 * Never logs the plain secret.
 */
export function decryptMfaSecret(encryptedString) {
  if (!encryptedString || typeof encryptedString !== 'string') return null;
  const parts = encryptedString.split(':');
  if (parts.length !== 3) return null;

  try {
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Generates a 20-byte random TOTP secret in Base32.
 */
export function generateMfaSecret() {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generates HOTP code for a given counter (RFC 4226).
 */
export function generateHOTP(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % 1000000;
  return String(code).padStart(6, '0');
}

/**
 * Generates TOTP code for a given time (RFC 6238, step = 30s).
 */
export function generateTOTP(secretBase32, timeMs = Date.now(), step = 30) {
  const secretBuffer = base32Decode(secretBase32);
  const counter = Math.floor(timeMs / 1000 / step);
  return generateHOTP(secretBuffer, counter);
}

/**
 * Verifies TOTP code allowing ±1 step drift and replay protection.
 */
export function verifyTotpCode(
  secretBase32,
  candidateCode,
  { timeMs = Date.now(), step = 30, window = 1, lastUsedStep = 0 } = {}
) {
  if (!secretBase32 || !candidateCode) return { valid: false, reason: 'missing_params' };
  const normalizedCandidate = String(candidateCode).trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalizedCandidate)) {
    return { valid: false, reason: 'invalid_format' };
  }

  const secretBuffer = base32Decode(secretBase32);
  const currentStep = Math.floor(timeMs / 1000 / step);

  for (let offset = -window; offset <= window; offset++) {
    const checkStep = currentStep + offset;
    const expected = generateHOTP(secretBuffer, checkStep);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedCandidate))) {
      if (checkStep <= lastUsedStep) {
        return { valid: false, reason: 'replayed' };
      }
      return { valid: true, step: checkStep };
    }
  }

  return { valid: false, reason: 'invalid_code' };
}

/**
 * Generates otpauth URI for TOTP apps.
 */
export function getOtpauthUrl(email, secretBase32, issuer = 'Brandframe') {
  const encIssuer = encodeURIComponent(issuer);
  const encAccount = encodeURIComponent(email);
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Hashes a recovery code for secure database storage.
 */
export function hashRecoveryCode(code) {
  const clean = String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Generates 10 recovery codes (formatted as XXXX-XXXX).
 */
export function generateRecoveryCodes(count = 10) {
  const rawCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    rawCodes.push(formatted);
    hashedCodes.push(hashRecoveryCode(formatted));
  }

  return { rawCodes, hashedCodes };
}

/**
 * Verifies and consumes a recovery code (single use).
 */
export async function verifyAndConsumeRecoveryCode(userId, candidateCode) {
  if (!candidateCode) return false;
  const hashed = hashRecoveryCode(candidateCode);

  const user = await User.findById(userId).select('+mfa.recoveryCodesHashed');
  if (!user || !user.mfa?.enabled || !Array.isArray(user.mfa.recoveryCodesHashed)) {
    return false;
  }

  const index = user.mfa.recoveryCodesHashed.indexOf(hashed);
  if (index === -1) return false;

  // Consume single-use code
  user.mfa.recoveryCodesHashed.splice(index, 1);
  await user.save();
  return true;
}

/**
 * Rate limits MFA verification attempts per user in MongoDB.
 */
export async function checkMfaRateLimit(userId) {
  return consumeRateLimit({
    key: `mfa-attempts:${userId}`,
    limit: 5,
    windowMs: 15 * 60 * 1000, // 5 attempts per 15 mins
  });
}

/**
 * Helper to verify step-up authentication.
 * Checks stepUpPassword or stepUpCode from body or headers.
 */
export async function verifyStepUpAuth(req, user) {
  const stepUpPassword =
    req.body?.stepUpPassword ||
    req.headers?.['x-step-up-password'] ||
    req.body?.password ||
    req.body?.currentPassword;
  const stepUpCode = req.body?.stepUpCode || req.headers?.['x-step-up-code'] || req.body?.code;

  if (!stepUpPassword && !stepUpCode) {
    const err = new Error('Re-authentication required. Provide your current password or verification code.');
    err.status = 401;
    err.code = 'STEP_UP_REQUIRED';
    throw err;
  }

  // If password provided, verify password
  if (stepUpPassword) {
    const userWithPw = await User.findById(user._id).select('+passwordHash');
    if (!userWithPw || !(await userWithPw.comparePassword(stepUpPassword))) {
      const err = new Error('Incorrect password for verification.');
      err.status = 401;
      throw err;
    }
    return true;
  }

  // If TOTP code provided and MFA is enabled
  if (stepUpCode) {
    const userWithMfa = await User.findById(user._id).select('+mfa.secretEncrypted');
    if (!userWithMfa?.mfa?.enabled || !userWithMfa.mfa.secretEncrypted) {
      const err = new Error('Multi-factor authentication is not enabled on your account. Provide your password.');
      err.status = 400;
      throw err;
    }

    const secret = decryptMfaSecret(userWithMfa.mfa.secretEncrypted);
    const verification = verifyTotpCode(secret, stepUpCode, {
      lastUsedStep: userWithMfa.mfa.lastUsedStep || 0,
    });

    if (!verification.valid) {
      const err = new Error('Invalid or expired verification code.');
      err.status = 401;
      throw err;
    }

    // Update lastUsedStep
    await User.updateOne({ _id: user._id }, { $set: { 'mfa.lastUsedStep': verification.step } });
    return true;
  }

  const err = new Error('Verification failed.');
  err.status = 401;
  throw err;
}

/**
 * Enforces step-up authentication if the user has MFA enabled,
 * or verifies step-up credentials if explicitly supplied.
 */
export async function requireStepUpIfMfa(req, user) {
  if (user?.mfa?.enabled) {
    return verifyStepUpAuth(req, user);
  }
  if (
    req.body?.stepUpPassword ||
    req.headers?.['x-step-up-password'] ||
    req.body?.stepUpCode ||
    req.headers?.['x-step-up-code']
  ) {
    return verifyStepUpAuth(req, user);
  }
  return true;
}

