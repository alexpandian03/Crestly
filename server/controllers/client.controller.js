import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';

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
    await Template.create(getDefaultTemplateData(client._id, client.name));
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
        return res.status(403).json({
          success: false,
          error: { message: "You don't have access to this organization.", status: 403 },
        });
      }
    }
    const client = await Client.findById(req.params.id);
    if (!client) return sendNotFound(res);
    return res.status(200).json({ success: true, data: { client } });
  } catch (err) {
    return next(err);
  }
}

/** A client administrator may change only how its own organization makes posters. */
function designModesOnlyDenied(res) {
  return res.status(403).json({
    success: false,
    error: {
      message: 'Design settings are the only thing you can change for your organization here.',
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
        return res.status(403).json({
          success: false,
          error: { message: "You don't have access to this organization.", status: 403 },
        });
      }
      const keys = Object.keys(req.body).filter((key) => req.body[key] !== undefined);
      if (keys.length !== 1 || keys[0] !== 'designModes') return designModesOnlyDenied(res);
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

    const client = await Client.findByIdAndUpdate(req.params.id, changes, {
      new: true,
      runValidators: true,
    });
    if (!client) return sendNotFound(res);
    return res.status(200).json({ success: true, data: { client } });
  } catch (err) {
    return next(err);
  }
}

export async function deactivateClient(req, res, next) {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true, runValidators: true }
    );
    if (!client) return sendNotFound(res);
    return res.status(200).json({ success: true, data: { client } });
  } catch (err) {
    return next(err);
  }
}
