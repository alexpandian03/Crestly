import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import Template from '../models/Template.model.js';
import User from '../models/User.model.js';
import Poster from '../models/Poster.model.js';
import Session from '../models/Session.model.js';
import Token from '../models/Token.model.js';
import Asset from '../models/Asset.model.js';
import { createStandardTemplates } from '../../shared/defaultTemplates.js';
import { audit } from '../services/audit.service.js';

function sendNotFound(res) {
  return res.status(404).json({ success: false, error: { message: 'Client not found', status: 404 } });
}

export async function getAllClients(req, res, next) {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { clients } });
  } catch (err) {
    return next(err);
  }
}

export async function createClient(req, res, next) {
  try {
    const client = await Client.create({ name: req.body.name, plan: req.body.plan, isActive: true });
    await BrandKit.create({ clientId: client._id, orgName: client.name });
    const standards = createStandardTemplates(client._id);
    await Template.insertMany(standards, { ordered: false });
    return res.status(201).json({ success: true, data: { client } });
  } catch (err) {
    return next(err);
  }
}

export async function getOwnClient(req, res, next) {
  try {
    const clientId = req.user.clientId?._id || req.user.clientId;
    const client = await Client.findById(clientId);
    if (!client) return sendNotFound(res);
    return res.status(200).json({ success: true, data: { client } });
  } catch (err) {
    return next(err);
  }
}

export async function getClientById(req, res, next) {
  try {
    if (req.user.role !== 'superadmin') {
      const ownId = req.user.clientId?._id || req.user.clientId;
      if (String(ownId) !== req.params.id) {
        return sendNotFound(res);
      }
    }
    const client = await Client.findById(req.params.id);
    if (!client) return sendNotFound(res);
    return res.status(200).json({ success: true, data: { client } });
  } catch (err) {
    return next(err);
  }
}

/** A client administrator may change only how its own organization works. */
function settingsOnlyDenied(res) {
  return res.status(403).json({
    success: false,
    error: {
      message: 'You can only change organization settings here.',
      status: 403,
    },
  });
}

function ownClientId(req) {
  return req.user.clientId?._id || req.user.clientId;
}

export async function updateClient(req, res, next) {
  try {
    if (req.user.role !== 'superadmin') {
      if (String(ownClientId(req)) !== req.params.id) {
        return sendNotFound(res);
      }
      const keys = Object.keys(req.body).filter((key) => req.body[key] !== undefined);
      const allowedKeys = [
        'designModes',
        'designPalette',
        'requireMfaForAdmins',
        'sessionLength',
        'allowedEmailDomains',
        'minPasswordLength',
        'requireApprovalForPosters',
        'requireEmailVerification',
      ];
      if (keys.some((k) => !allowedKeys.includes(k))) return settingsOnlyDenied(res);
    }

    const stored = await Client.findById(req.params.id).select('designModes').lean();
    if (!stored) return sendNotFound(res);

    const changes = { ...req.body };
    if (changes.designModes) {
      /* The two switches are stored whole, and at least one stays on: without either one this
         organization could not make a poster at all. */
      const modes = {
        ai: changes.designModes.ai ?? stored.designModes?.ai ?? true,
        templates: changes.designModes.templates ?? stored.designModes?.templates ?? true,
      };
      if (!modes.ai && !modes.templates) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Keep at least one way of making posters switched on.',
            status: 400,
          },
        });
      }
      changes.designModes = modes;
    }

    if (changes.allowedEmailDomains !== undefined) {
      if (typeof changes.allowedEmailDomains === 'string') {
        changes.allowedEmailDomains = changes.allowedEmailDomains
          .split(/[\s,]+/)
          .map((d) => d.toLowerCase().trim().replace(/^@/, ''))
          .filter(Boolean);
      } else if (Array.isArray(changes.allowedEmailDomains)) {
        changes.allowedEmailDomains = changes.allowedEmailDomains
          .map((d) => String(d || '').toLowerCase().trim().replace(/^@/, ''))
          .filter(Boolean);
      }
    }

    if (changes.minPasswordLength !== undefined) {
      const minLen = parseInt(changes.minPasswordLength, 10);
      if (isNaN(minLen) || minLen < 10 || minLen > 16) {
        return res.status(400).json({
          success: false,
          error: { message: 'Minimum password length must be between 10 and 16 characters.', status: 400 },
        });
      }
      changes.minPasswordLength = minLen;
    }

    if (changes.sessionLength !== undefined && !['8h', '7d', '30d'].includes(changes.sessionLength)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Session length must be 8 hours (8h), 7 days (7d), or 30 days (30d).', status: 400 },
      });
    }

    const client = await Client.findByIdAndUpdate(req.params.id, changes, {
      new: true,
      runValidators: true,
    });
    if (!client) return sendNotFound(res);

    await audit(req, 'client.settings_update', client, {
      meta: {
        changes: Object.keys(changes),
        sessionLength: client.sessionLength,
        requireMfaForAdmins: client.requireMfaForAdmins,
        minPasswordLength: client.minPasswordLength,
      },
    });

    return res.status(200).json({ success: true, data: { client } });
  } catch (err) {
    return next(err);
  }
}

export async function deleteClient(req, res, next) {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only super administrators can delete organizations.', status: 403 },
      });
    }

    const client = await Client.findById(req.params.id);
    if (!client) return sendNotFound(res);

    if (req.query.deactivate === 'true') {
      client.isActive = false;
      await client.save();
      await audit(req, 'client.deactivate', client, { meta: { name: client.name } });
      return res.status(200).json({ success: true, data: { client } });
    }

    const users = await User.find({ clientId: client._id }).select('_id');
    const userIds = users.map((u) => u._id);

    if (userIds.length > 0) {
      await Session.deleteMany({ userId: { $in: userIds } });
      await Token.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    await Poster.deleteMany({ clientId: client._id });
    await Template.deleteMany({ clientId: client._id });
    await BrandKit.deleteMany({ clientId: client._id });
    await Asset.deleteMany({ clientId: client._id });
    await Client.findByIdAndDelete(client._id);

    await audit(req, 'client.delete', client, {
      meta: { name: client.name, usersCount: userIds.length },
    });

    return res.status(200).json({
      success: true,
      data: { deleted: true, id: String(client._id), name: client.name },
    });
  } catch (err) {
    return next(err);
  }
}

export async function deactivateClient(req, res, next) {
  req.query.deactivate = 'true';
  return deleteClient(req, res, next);
}

