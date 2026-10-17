import AuditEvent from '../models/AuditEvent.model.js';
import User from '../models/User.model.js';
import { formatAuditCsv, formatAuditSentence } from '../../shared/auditSentences.js';
import { requireStepUpIfMfa } from '../services/mfa.service.js';

function buildFilter(req) {
  const filter = {};

  // Tenant scoping: clientadmin restricted to own clientId, superadmin can view all or filter
  if (req.user.role !== 'superadmin') {
    filter.clientId = req.clientId || req.user.clientId?._id || req.user.clientId;
  } else if (req.query.clientId) {
    filter.clientId = req.query.clientId;
  }

  // Action filter
  if (req.query.action) {
    const rawAction = String(req.query.action).trim();
    if (rawAction.endsWith('*')) {
      filter.action = new RegExp(`^${rawAction.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    } else {
      filter.action = rawAction;
    }
  }

  // Result filter (success / failure)
  if (req.query.result && ['success', 'failure'].includes(req.query.result)) {
    filter.result = req.query.result;
  }

  // Date filter
  const now = new Date();
  if (req.query.date) {
    if (req.query.date === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filter.createdAt = { $gte: startOfDay };
    } else if (req.query.date === '7d') {
      filter.createdAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (req.query.date === '30d') {
      filter.createdAt = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }
  } else if (req.query.dateFrom || req.query.dateTo || req.query.startDate || req.query.endDate) {
    const from = req.query.dateFrom || req.query.startDate;
    const to = req.query.dateTo || req.query.endDate;
    filter.createdAt = {};
    if (from) {
      const parsedFrom = new Date(from);
      if (!isNaN(parsedFrom.getTime())) filter.createdAt.$gte = parsedFrom;
    }
    if (to) {
      const parsedTo = new Date(to);
      if (!isNaN(parsedTo.getTime())) filter.createdAt.$lte = parsedTo;
    }
  }

  return filter;
}

export async function getAuditLogs(req, res, next) {
  try {
    const filter = buildFilter(req);

    // Actor filter: match ObjectId or search user name / email
    if (req.query.actor) {
      const actorQuery = String(req.query.actor).trim();
      if (/^[0-9a-fA-F]{24}$/.test(actorQuery)) {
        filter.actorId = actorQuery;
      } else {
        const matchingUsers = await User.find({
          $or: [
            { name: new RegExp(actorQuery, 'i') },
            { email: new RegExp(actorQuery, 'i') },
          ],
        }).select('_id');
        filter.actorId = { $in: matchingUsers.map((u) => u._id) };
      }
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      AuditEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email role')
        .populate('clientId', 'name')
        .lean(),
      AuditEvent.countDocuments(filter),
    ]);

    const formattedEvents = events.map((event) => ({
      ...event,
      sentence: formatAuditSentence(event),
    }));

    return res.status(200).json({
      success: true,
      data: {
        events: formattedEvents,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function exportAuditLogsCsv(req, res, next) {
  try {
    const actor = await User.findById(req.user._id).select('+passwordHash +mfa.secretEncrypted');
    await requireStepUpIfMfa(req, actor);

    const filter = buildFilter(req);

    if (req.query.actor) {
      const actorQuery = String(req.query.actor).trim();
      if (/^[0-9a-fA-F]{24}$/.test(actorQuery)) {
        filter.actorId = actorQuery;
      } else {
        const matchingUsers = await User.find({
          $or: [
            { name: new RegExp(actorQuery, 'i') },
            { email: new RegExp(actorQuery, 'i') },
          ],
        }).select('_id');
        filter.actorId = { $in: matchingUsers.map((u) => u._id) };
      }
    }

    // Limit export to 5000 rows for serverless safety
    const events = await AuditEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .populate('actorId', 'name email role')
      .populate('clientId', 'name')
      .lean();

    const csvContent = formatAuditCsv(events);
    const dateStr = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${dateStr}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return next(err);
  }
}
