import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['verify', 'invite', 'reset', 'email-change', 'mfa'],
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    role: {
      type: String,
      enum: ['superadmin', 'clientadmin', 'user'],
      default: null,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

tokenSchema.index({ type: 1, email: 1 });
tokenSchema.index({ type: 1, userId: 1 });

const Token = mongoose.models.Token || mongoose.model('Token', tokenSchema);

export default Token;
