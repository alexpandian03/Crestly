import crypto from 'crypto';
import AuditEvent from '../models/AuditEvent.model.js';
import Client from '../models/Client.model.js';

const PLAN_RETENTION_DAYS = {
  free: 90,
  starter: 365,
  pro: 365,
  enterprise: 730,
};

const BANNED_META_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'passwordhash',
  'token',
  'rawtoken',
  'refreshtoken',
  'accesstoken',
  'tokenhash',
  'secret',
  'jwt',
  'apikey',
  'authorization',
  'cookie',
  'content',
  'elements',
  'zones',
  'imagedata',
  'imagebytes',
  'body',
]);

/**
 * Strips secrets, credentials, tokens, hashes and large content payloads from meta.
 */
export function sanitizeAuditMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const cleaned = {};
  for (const [key, val] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (BANNED_META_KEYS.has(lowerKey)) continue;
    if (val === null || val === undefined) continue;

    if (typeof val === 'string') {
      // Limit field length to prevent storing huge text or accidental blobs
      cleaned[key] = val.slice(0, 300);
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      cleaned[key] = val;
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      cleaned[key] = sanitizeAuditMeta(val);
    }
  }
  return cleaned;
}

export function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
}

/**
 * Asynchronous, non-blocking audit logging helper.
 * Never throws or fails the parent request.
 */
export async function audit(req, action, target = null, options = {}) {
  try {
    const result = options.result || 'success';
    const rawMeta = options.meta || (target && typeof target === 'object' && target.meta) || {};
    const meta = sanitizeAuditMeta(rawMeta);

    // Resolve target info
    let targetType = null;
    let targetId = null;
    if (typeof target === 'string') {
      targetType = target;
    } else if (target && typeof target === 'object') {
      targetType =
        target.targetType ||
        target.type ||
        target.constructor?.modelName ||
        (target._id ? 'Document' : null);
      targetId = target.targetId || target.id || target._id?.toString() || null;
    }

    // Resolve actorId
    const actorId = options.actorId || req?.user?._id || req?.user?.id || null;

    // Resolve clientId
    let clientId =
      options.clientId ||
      req?.clientId ||
      req?.user?.clientId?._id ||
      req?.user?.clientId ||
      null;
    if (!clientId && target && typeof target === 'object' && target.clientId) {
      clientId = target.clientId?._id || target.clientId;
    }

    // Determine retention based on client plan
    let retentionDays = 365;
    if (clientId) {
      try {
        const client = await Client.findById(clientId).select('plan auditRetentionDays').lean();
        if (client) {
          retentionDays = client.auditRetentionDays || PLAN_RETENTION_DAYS[client.plan] || 365;
        }
      } catch {}
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

    const ip = req?.ip || req?.socket?.remoteAddress || null;
    const ipHash = hashIp(ip);
    const userAgent = String(req?.headers?.['user-agent'] || '').slice(0, 500);
    const requestId = req?.id || req?.headers?.['x-request-id'] || null;

    return await AuditEvent.create({
      clientId: clientId || null,
      actorId: actorId || null,
      action: String(action).trim(),
      targetType,
      targetId: targetId ? String(targetId) : null,
      result,
      ipHash,
      userAgent,
      requestId,
      meta,
      createdAt: now,
      expiresAt,
    });
  } catch (err) {
    // Non-blocking: record warning and allow request to continue smoothly
    console.warn(`[AuditEvent Warning] Could not record "${action}":`, err.message);
    return null;
  }
}

// In-memory window tracker for permission denials
const denialCounts = new Map();
const DENIAL_THRESHOLD = 3;
const WINDOW_MS = 15 * 60 * 1000;

export async function recordPermissionDenial(req, permission, threshold = DENIAL_THRESHOLD) {
  try {
    const key = req?.user?._id?.toString() || req?.ip || 'unknown';
    const now = Date.now();
    const entry = denialCounts.get(key) || { count: 0, firstAt: now };

    if (now - entry.firstAt > WINDOW_MS) {
      entry.count = 1;
      entry.firstAt = now;
    } else {
      entry.count += 1;
    }
    denialCounts.set(key, entry);

    if (entry.count >= threshold) {
      await audit(
        req,
        'auth.permission_denied',
        { type: 'Permission', id: permission },
        {
          result: 'failure',
          meta: { permission, count: entry.count },
        }
      );
    }
  } catch (err) {
    console.warn('[AuditEvent Warning] Could not record denial:', err.message);
  }
}

export function resetDenialCounts() {
  denialCounts.clear();
}
