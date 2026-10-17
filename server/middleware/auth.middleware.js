import mongoose from 'mongoose';
import { verifyToken } from '../services/auth.service.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';

import Session from '../models/Session.model.js';

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: { message, status } });
}

export async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.token || req.cookies?.accessToken;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }


    if (!token) {
      return sendError(res, 401, 'Authentication required');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return sendError(res, 401, 'Invalid or expired authentication token');
    }

    const user = await User.findById(decoded.userId).populate('clientId', 'name isActive');
    if (!user?.isActive) {
      return sendError(res, 401, 'Your session is no longer active. Please log in again.');
    }
    if (user.role !== 'superadmin' && (!user.clientId || !user.clientId.isActive)) {
      return sendError(res, 401, 'Your organization is inactive. Please contact an administrator.');
    }
    if (
      decoded.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return sendError(res, 401, 'Your session is no longer active. Please log in again.');
    }

    if (decoded.sessionId) {
      const session = await Session.findById(decoded.sessionId);
      if (!session || session.revokedAt) {
        return sendError(res, 401, 'Your session is no longer active. Please log in again.');
      }
      req.sessionId = session._id;
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

import { can } from '../../shared/permissions.js';
import { recordPermissionDenial } from '../services/audit.service.js';

export function requirePermission(permission) {
  const middleware = async (req, res, next) => {
    if (!req.user) return sendError(res, 401, 'Authentication required');
    if (!can(req.user, permission)) {
      try {
        await recordPermissionDenial(req, permission);
      } catch {}
      return sendError(res, 403, "You don't have access to this action.");
    }
    req.requiredPermission = permission;
    return next();
  };
  middleware._permission = permission;
  middleware._isPolicy = true;
  return middleware;
}

export function allowAnonymous() {
  const middleware = (req, res, next) => next();
  middleware._permission = 'public';
  middleware._isPolicy = true;
  return middleware;
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 401, 'Authentication required');
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, "You don't have access to this action.");
    }
    return next();
  };
}

export async function tenantGuard(req, res, next) {
  try {
    if (!req.user) return sendError(res, 401, 'Authentication required');

    if (req.user.role !== 'superadmin') {
      const clientId = req.user.clientId?._id || req.user.clientId;
      if (!clientId) return sendError(res, 403, 'Your account is not assigned to an organization.');
      req.clientId = clientId;
      return next();
    }

    const value = req.headers['x-client-id'] || req.query.clientId;
    if (!value || Array.isArray(value)) {
      return sendError(res, 400, 'Choose an organization before using this feature.');
    }
    if (!mongoose.isValidObjectId(value)) {
      return sendError(res, 400, 'The selected organization is invalid.');
    }
    const client = await Client.findById(value).select('_id');
    if (!client) return sendError(res, 400, 'The selected organization does not exist.');

    req.clientId = client._id;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function scopedFilter(req, filter = {}) {
  if (!req.clientId) {
    const error = new Error('Organization context is required');
    error.status = 400;
    throw error;
  }
  return { ...filter, clientId: req.clientId };
}
