import mongoose from 'mongoose';
import { verifyToken } from '../services/auth.service.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: { message, status } });
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return sendError(res, 401, 'Authentication required');
    }

    let decoded;
    try {
      decoded = verifyToken(authHeader.slice(7));
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

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
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
