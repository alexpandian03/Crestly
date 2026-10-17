import mongoose from 'mongoose';

/**
 * Append-only AuditEvent model.
 * Records operational and security events per tenant and global actors.
 * No update or delete operations are permitted.
 */
const auditEventSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      index: true,
    },
    targetType: {
      type: String,
      default: null,
      trim: true,
    },
    targetId: {
      type: String,
      default: null,
      trim: true,
    },
    result: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
      required: true,
    },
    ipHash: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: '',
    },
    requestId: {
      type: String,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 365-day retention
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for tenant-scoped date sorting
auditEventSchema.index({ clientId: 1, createdAt: -1 });
auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });
auditEventSchema.index({ actorId: 1, createdAt: -1 });

// TTL index for automatic retention expiration
auditEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuditEvent =
  mongoose.models.AuditEvent || mongoose.model('AuditEvent', auditEventSchema);

export default AuditEvent;
