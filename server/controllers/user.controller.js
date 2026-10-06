import crypto from 'crypto';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import { createUser, publicUser } from '../services/auth.service.js';
import { scopedFilter } from '../middleware/auth.middleware.js';

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
  const removingClientAdmin = target.role === 'clientadmin' && changes.role === 'user';
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
    if (remaining === 0) throw httpError(400, 'The last active client administrator cannot be removed.');
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

    await protectLastAdministrator(target, changes);
    if (changes.name !== undefined) target.name = changes.name;
    if (changes.isActive !== undefined) target.isActive = changes.isActive;
    if (changes.role !== undefined) target.role = changes.role;
    await target.save();
    await target.populate('clientId', 'name isActive');

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

    return res.status(200).json({
      success: true,
      data: { temporaryPassword, user: publicUser(target) },
    });
  } catch (err) {
    return next(err);
  }
}
