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

export async function updateClient(req, res, next) {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, {
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
